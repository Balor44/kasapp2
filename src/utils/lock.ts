import crypto from 'crypto';

/** The small part of an ioredis client that the lock helpers need. */
export interface RedisLike {
  set(key: string, value: string, ...args: any[]): Promise<string | null>;
  get(key: string): Promise<string | null>;
  del(key: string): Promise<number>;
  eval?(script: string, numKeys: number, ...args: string[]): Promise<any>;
}

// Delete the key only if it still holds our token, so a lock that expired and was taken by someone
// else is never released by mistake.
const RELEASE_SCRIPT = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`;

export async function acquireLock(redis: RedisLike, key: string, ttlMs: number): Promise<string | null> {
  const token = crypto.randomBytes(16).toString('hex');
  const result = await redis.set(key, token, 'PX', ttlMs, 'NX');
  return result === 'OK' ? token : null;
}

export async function releaseLock(redis: RedisLike, key: string, token: string): Promise<boolean> {
  try {
    if (typeof redis.eval === 'function') {
      return Number(await redis.eval(RELEASE_SCRIPT, 1, key, token)) === 1;
    }
    if ((await redis.get(key)) === token) {
      return (await redis.del(key)) === 1;
    }
  } catch {
    // The lock expires by itself, so a failed release is not an error.
  }
  return false;
}

export type LockResult<T> = { acquired: false } | { acquired: true; value: T };

/** Runs `fn` only if the lock is free, and always releases it afterwards. */
export async function withLock<T>(redis: RedisLike, key: string, ttlMs: number, fn: () => Promise<T>): Promise<LockResult<T>> {
  const token = await acquireLock(redis, key, ttlMs);
  if (!token) return { acquired: false };
  try {
    return { acquired: true, value: await fn() };
  } finally {
    await releaseLock(redis, key, token);
  }
}

/** Like withLock, but waits up to `waitMs` for the lock to become free. */
export async function withLockWait<T>(
  redis: RedisLike,
  key: string,
  ttlMs: number,
  waitMs: number,
  fn: () => Promise<T>,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
): Promise<LockResult<T>> {
  const deadline = Date.now() + waitMs;
  for (;;) {
    const result = await withLock(redis, key, ttlMs, fn);
    if (result.acquired || Date.now() >= deadline) return result;
    await sleep(250);
  }
}
