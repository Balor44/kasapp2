import { kasToSompi, parseSompiString, sompiToKasNumber, formatKas } from './sompi';

/**
 * User balances are a cache of what is on chain. The exact value is `balanceSompi`, a string of
 * whole sompi (1 KAS = 100,000,000 sompi), and all arithmetic on it uses BigInt. The old floating
 * point `balance` field is still written, for display and for older code, but is never read for
 * a money decision once `balanceSompi` exists.
 */
export interface BalanceHolder {
  balanceSompi?: string | null;
  balance?: number | null;
}

export function userBalanceSompi(user: BalanceHolder): bigint {
  if (typeof user.balanceSompi === 'string' && /^\d+$/.test(user.balanceSompi)) {
    return BigInt(user.balanceSompi);
  }
  // Documents created before the migration only have the floating point field.
  const legacy = Number(user.balance ?? 0);
  if (!Number.isFinite(legacy) || legacy <= 0) return 0n;
  try {
    return kasToSompi(legacy);
  } catch {
    return 0n;
  }
}

export function balanceFields(sompi: bigint): { balanceSompi: string; balance: number } {
  const exact = parseSompiString(sompi);
  return { balanceSompi: exact.toString(), balance: sompiToKasNumber(exact) };
}

export function formatBalance(user: BalanceHolder, decimals = 4): string {
  return formatKas(userBalanceSompi(user), decimals);
}
