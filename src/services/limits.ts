import { kasToSompi } from "../utils/sompi";

export interface Limits {
  perTxSompi: bigint | null; // null = no limit
  perDaySompi: bigint | null;
}

/** Reads MAX_SEND_KAS_PER_TX and MAX_SEND_KAS_PER_DAY. Unset or invalid means no limit. */
export function readLimits(env: Record<string, string | undefined> = process.env): Limits {
  const parse = (v?: string): bigint | null => {
    if (!v || !v.trim()) return null;
    try { return kasToSompi(v.trim()); } catch { return null; }
  };
  return { perTxSompi: parse(env.MAX_SEND_KAS_PER_TX), perDaySompi: parse(env.MAX_SEND_KAS_PER_DAY) };
}

export type LimitResult = { ok: true } | { ok: false; reason: "PER_TX" | "PER_DAY"; limitSompi: bigint };

/** `sentTodaySompi` is what the user already sent in the last 24 hours, not counting this payment. */
export function checkLimits(amountSompi: bigint, sentTodaySompi: bigint, limits: Limits): LimitResult {
  if (limits.perTxSompi !== null && amountSompi > limits.perTxSompi) return { ok: false, reason: "PER_TX", limitSompi: limits.perTxSompi };
  if (limits.perDaySompi !== null && sentTodaySompi + amountSompi > limits.perDaySompi) return { ok: false, reason: "PER_DAY", limitSompi: limits.perDaySompi };
  return { ok: true };
}
