/**
 * Errors from sending KAS, split by one question that matters for money:
 * could the transaction have reached the network?
 */

/** The transaction was definitely not broadcast, so retrying or giving up is safe. */
export class NotSubmittedError extends Error {
  /** True when trying again later could work (wallet busy, node syncing, payout wallet short of funds). */
  readonly retryable: boolean;
  /** Short machine readable reason such as INSUFFICIENT_FUNDS, INVALID_ADDRESS, WALLET_BUSY. */
  readonly reason: string;
  constructor(message: string, reason = 'NOT_SUBMITTED', retryable = false) {
    super(message);
    this.name = 'NotSubmittedError';
    this.reason = reason;
    this.retryable = retryable;
  }
}

/** The transaction may or may not have been broadcast. Nobody may assume either way. */
export class UnknownSubmitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnknownSubmitError';
  }
}
