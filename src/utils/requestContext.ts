import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

/** Carries the WhatsApp message id down to money code, so a redelivered message can never pay twice. */
const storage = new AsyncLocalStorage<{ messageId: string }>();

export function runWithMessage<T>(messageId: string | undefined, fn: () => Promise<T>): Promise<T> {
  return storage.run({ messageId: messageId || `anon-${randomUUID()}` }, fn);
}

/** Stable per message. Without a message id (for example the REST API) it is unique per call. */
export function currentMessageId(): string {
  return storage.getStore()?.messageId || `anon-${randomUUID()}`;
}

/** Sets the message id for everything that runs after this call in the current async flow. */
export function enterMessage(messageId: string | undefined): void {
  storage.enterWith({ messageId: messageId || `anon-${randomUUID()}` });
}
