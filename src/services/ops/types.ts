import { InputsCheck, PaymentCheck } from "../../wallet/kaspa.service";

export type OpKind = "PAYOUT" | "BILL";

/**
 * PAYOUT: PENDING -> SIGNED -> CONFIRMED | FAILED | NEEDS_REVIEW
 * BILL:   PENDING -> CALLED -> DELIVERED | FAILED | NEEDS_REVIEW
 * FAILED means "definitely did not happen", so refunds and retries are safe.
 * NEEDS_REVIEW means a human decides. Nothing automatic ever pays or refunds from it.
 */
export type OpState = "PENDING" | "SIGNED" | "CALLED" | "CONFIRMED" | "DELIVERED" | "FAILED" | "NEEDS_REVIEW";

export const TERMINAL: OpState[] = ["CONFIRMED", "DELIVERED", "FAILED", "NEEDS_REVIEW"];

export interface Operation {
  key: string; // idempotency key, unique
  kind: OpKind;
  state: OpState;
  params: Record<string, any>; // payout: {fromWallet, toAddress, amountSompi (string)}; bill: provider specific
  txids: string[];
  inputs: string[];
  providerRef?: string;
  attempts: number;
  leaseUntil?: number; // epoch ms, 0/undefined = free
  lastError?: string;
  refunded?: boolean;
  followedUp?: boolean;
  signedAt?: number;
  updatedAt: number;
  createdAt: number;
}

/** Storage with compare and swap semantics. Two workers can never both win a transition. */
export interface OpStore {
  /** Returns the existing operation for the key, or creates it. */
  getOrCreate(key: string, kind: OpKind, params: Record<string, any>): Promise<Operation>;
  get(key: string): Promise<Operation | null>;
  /** Takes the lease if it is free or expired. Returns the operation when taken, null otherwise. */
  lease(key: string, now: number, ttlMs: number): Promise<Operation | null>;
  /** Applies a patch only if the state still equals `from`. Returns false if someone else moved it. */
  transition(key: string, from: OpState, patch: Partial<Operation>): Promise<boolean>;
  release(key: string): Promise<void>;
  /** Non terminal operations whose lease is free or expired. */
  listOpen(now: number, limit: number): Promise<Operation[]>;
  /** Marks a refund as done exactly once. True only for the caller that flipped it. */
  markRefunded(key: string): Promise<boolean>;
  /** Terminal operations that carry follow up work (params.next) not yet dispatched. */
  listUnfollowed(limit: number): Promise<Operation[]>;
  /** Marks follow up as dispatched exactly once. */
  markFollowed(key: string): Promise<boolean>;
}

/**
 * Work to start when an operation ends in a given state, kept inside the operation itself so it
 * survives crashes. Dispatch is idempotent because every follow up has its own stable key.
 */
export type FollowUp =
  | { kind: "PAYOUT" | "BILL"; key: string; params: Record<string, any> }
  | { kind: "CREDIT"; key: string; userId: string; sompi: string };
export type FollowUps = Partial<Record<OpState, FollowUp>>;

export interface Chain {
  sendSompi(
    fromWallet: string,
    toAddress: string,
    amountSompi: bigint,
    hooks: { onBeforeSubmit: (i: { txid: string; inputs: string[] }) => Promise<void> }
  ): Promise<{ txid: string; txids: string[] }>;
  checkPayment(txid: string, toAddress: string, amountSompi: bigint): Promise<PaymentCheck>;
  checkInputs(fromAddress: string, inputs: string[]): Promise<InputsCheck>;
}

export type ProviderResult = "DELIVERED" | "FAILED" | "PENDING";

export interface BillProvider {
  /** Pays the bill under a stable request id. Throws when the outcome is unknown (timeout). */
  pay(requestId: string, params: Record<string, any>): Promise<ProviderResult>;
  /** Asks the provider what happened to a request id. Throws or returns PENDING when still unknown. */
  requery(requestId: string, params: Record<string, any>): Promise<ProviderResult>;
}

export interface EngineDeps {
  store: OpStore;
  chain: Chain;
  provider?: BillProvider;
  now?: () => number;
  leaseMs?: number;
  /** Time after signing before "not found and inputs unspent" is accepted as "never broadcast". */
  settleMs?: number;
  /** Called once when an operation becomes FAILED and money should go back. */
  onRefund?: (op: Operation) => Promise<void>;
  alert?: (message: string, op: Operation) => void;
  /** Applies a CREDIT follow up exactly once (the ref makes it idempotent). */
  credit?: (userId: string, sompi: bigint, ref: string) => Promise<unknown>;
}
