import { NotSubmittedError, UnknownSubmitError } from "../../utils/chainErrors";
import { EngineDeps, FollowUps, Operation, OpState, TERMINAL } from "./types";

const DEFAULT_LEASE_MS = 60_000;
const DEFAULT_SETTLE_MS = 120_000;

function msg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function isTerminal(state: OpState): boolean {
  return TERMINAL.includes(state);
}

export function createEngine(deps: EngineDeps) {
  const now = deps.now ?? (() => Date.now());
  const leaseMs = deps.leaseMs ?? DEFAULT_LEASE_MS;
  const settleMs = deps.settleMs ?? DEFAULT_SETTLE_MS;
  const { store, chain } = deps;

  async function settle(op: Operation, from: OpState, to: OpState, patch: Partial<Operation> = {}): Promise<Operation> {
    const ok = await store.transition(op.key, from, { ...patch, state: to, updatedAt: now() });
    if (!ok) return (await store.get(op.key)) as Operation;
    const next = (await store.get(op.key)) as Operation;
    if (to === "FAILED" && deps.onRefund && (await store.markRefunded(op.key))) {
      try {
        await deps.onRefund(next);
      } catch (err) {
        deps.alert?.(`Refund callback failed for ${op.key}: ${msg(err)}`, next);
      }
    }
    if (to === "NEEDS_REVIEW") deps.alert?.(`Operation ${op.key} needs review: ${patch.lastError ?? ""}`, next);
    return next;
  }

  // ---------------- PAYOUT ----------------

  async function runPayout(op: Operation): Promise<Operation> {
    const { fromWallet, toAddress } = op.params;
    const amount = BigInt(op.params.amountSompi);

    if (op.state === "PENDING") {
      try {
        await chain.sendSompi(fromWallet, toAddress, amount, {
          onBeforeSubmit: async ({ txid, inputs }) => {
            // Write ahead: the txid is durable BEFORE the broadcast. If this write loses a race
            // or fails, the error aborts the send and nothing goes out.
            const from: OpState = (await store.get(op.key))?.state ?? "PENDING";
            const current = (await store.get(op.key)) as Operation;
            const ok = await store.transition(op.key, from, {
              state: "SIGNED",
              txids: [...current.txids, txid],
              inputs: [...new Set([...current.inputs, ...inputs])],
              signedAt: current.signedAt ?? now(),
              updatedAt: now(),
            });
            if (!ok) throw new Error("Operation moved while signing.");
          },
        });
        return await settle((await store.get(op.key)) as Operation, "SIGNED", "CONFIRMED");
      } catch (err) {
        const fresh = (await store.get(op.key)) as Operation;
        if (err instanceof UnknownSubmitError) {
          // Stay SIGNED. The reconciler looks the transaction up. Never refund, never resend.
          await store.transition(op.key, fresh.state, { lastError: err.message, updatedAt: now() });
          return (await store.get(op.key)) as Operation;
        }
        if (err instanceof NotSubmittedError && fresh.state === "PENDING") {
          if (err.retryable && fresh.attempts < 5) {
            await store.transition(op.key, "PENDING", { attempts: fresh.attempts + 1, lastError: err.message, updatedAt: now() });
            return (await store.get(op.key)) as Operation;
          }
          return settle(fresh, "PENDING", "FAILED", { lastError: err.message });
        }
        // Anything else after a txid was recorded: unknown outcome, reconciler decides.
        await store.transition(op.key, fresh.state, { lastError: msg(err), updatedAt: now() });
        return (await store.get(op.key)) as Operation;
      }
    }

    if (op.state === "SIGNED") return reconcilePayout(op);
    return op;
  }

  async function reconcilePayout(op: Operation): Promise<Operation> {
    const toAddress = op.params.toAddress as string;
    const amount = BigInt(op.params.amountSompi);
    const last = op.txids[op.txids.length - 1];
    if (!last) return settle(op, "SIGNED", "NEEDS_REVIEW", { lastError: "Signed without a txid." });

    const paid = await chain.checkPayment(last, toAddress, amount);
    if (paid === "PAID") return settle(op, "SIGNED", "CONFIRMED");
    if (paid === "SEEN_NOT_PAYING") {
      return settle(op, "SIGNED", "NEEDS_REVIEW", { lastError: "Transaction seen but outputs do not match the payout." });
    }
    if (paid === "UNKNOWN") return op;

    // NOT_FOUND: only accept "never broadcast" after the settle window AND all inputs still unspent.
    if (now() - (op.signedAt ?? 0) < settleMs) return op;
    const inputs = await chain.checkInputs(op.params.fromAddress ?? op.params.fromWallet, op.inputs);
    if (inputs === "ALL_UNSPENT") {
      return settle(op, "SIGNED", "FAILED", { lastError: "Not broadcast: inputs still unspent after settle window." });
    }
    if (inputs === "UNKNOWN") return op;
    return settle(op, "SIGNED", "NEEDS_REVIEW", {
      lastError: "Inputs were spent but the payment was not found. Possible pruned or replaced transaction.",
    });
  }

  // ---------------- BILL ----------------

  async function runBill(op: Operation): Promise<Operation> {
    const provider = deps.provider;
    if (!provider) throw new Error("No bill provider configured.");
    const requestId = op.providerRef || op.key;

    if (op.state === "PENDING") {
      // Record intent BEFORE calling: after a crash we requery instead of paying again.
      if (!(await store.transition(op.key, "PENDING", { state: "CALLED", providerRef: requestId, updatedAt: now() }))) {
        return (await store.get(op.key)) as Operation;
      }
      op = (await store.get(op.key)) as Operation;
      try {
        const result = await provider.pay(requestId, op.params);
        return applyBill(op, result);
      } catch (err) {
        await store.transition(op.key, "CALLED", { lastError: msg(err), updatedAt: now() });
        return (await store.get(op.key)) as Operation; // unknown, stays CALLED, reconciler requeries
      }
    }
    if (op.state === "CALLED") return reconcileBill(op);
    return op;
  }

  async function applyBill(op: Operation, result: "DELIVERED" | "FAILED" | "PENDING"): Promise<Operation> {
    if (result === "DELIVERED") return settle(op, "CALLED", "DELIVERED");
    if (result === "FAILED") return settle(op, "CALLED", "FAILED", { lastError: "Provider reported failure." });
    return op;
  }

  async function reconcileBill(op: Operation): Promise<Operation> {
    const provider = deps.provider;
    if (!provider) return op;
    try {
      return await applyBill(op, await provider.requery(op.providerRef || op.key, op.params));
    } catch (err) {
      await store.transition(op.key, "CALLED", { lastError: msg(err), updatedAt: now() });
      return (await store.get(op.key)) as Operation;
    }
  }

  // ---------------- follow ups ----------------

  async function followUp(op: Operation): Promise<void> {
    if (!isTerminal(op.state) || op.followedUp) return;
    const next = op.params?.next as FollowUps | undefined;
    const spec = next?.[op.state];
    if (spec) {
      if (spec.kind === "CREDIT") {
        if (!deps.credit) throw new Error("No credit handler configured.");
        await deps.credit(spec.userId, BigInt(spec.sompi), spec.key);
      } else {
        await execute(spec.key, spec.kind, spec.params);
      }
    }
    await store.markFollowed(op.key);
  }

  // ---------------- public ----------------

  async function advance(op: Operation): Promise<Operation> {
    if (isTerminal(op.state)) return op;
    const leased = await store.lease(op.key, now(), leaseMs);
    if (!leased) return op; // someone else is working on it
    try {
      return leased.kind === "PAYOUT" ? await runPayout(leased) : await runBill(leased);
    } finally {
      await store.release(op.key);
    }
  }

  async function execute(key: string, kind: Operation["kind"], params: Record<string, any>): Promise<Operation> {
    const op = await store.getOrCreate(key, kind, params);
    const done = await advance(op);
    try {
      await followUp(done);
    } catch (err) {
      deps.alert?.(`Follow up failed for ${key}: ${msg(err)}`, done); // the sweep retries it
    }
    return done;
  }

  return {
    /** Idempotent: the same key always returns the same operation and never runs the action twice. */
    execute,
    advance,
    /** One reconciler pass. Returns how many operations were looked at. */
    async sweep(limit = 50): Promise<number> {
      const open = await store.listOpen(now(), limit);
      for (const op of open) {
        try {
          await advance(op);
        } catch (err) {
          deps.alert?.(`Reconciler error on ${op.key}: ${msg(err)}`, op);
        }
      }
      let unfollowed: Operation[] = [];
      try {
        unfollowed = await store.listUnfollowed(limit);
        for (const op of unfollowed) await followUp(op);
      } catch (err) {
        deps.alert?.(`Follow up sweep error: ${msg(err)}`, open[0] ?? ({} as Operation));
      }
      return open.length + unfollowed.length;
    },
  };
}

export type Engine = ReturnType<typeof createEngine>;
