/**
 * Minimal structured logger. Writes one JSON line per event so logs can be searched by opId,
 * and removes anything that looks like a secret before writing.
 */
const SECRET_KEYS = /mnemonic|seed|secret|password|(^|[_-])pin|pin($|[_-])|[a-z]Pin|token|authorization|api[-_]?key|private/i;

function redact(value: unknown, depth = 0): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (depth > 4) return '[depth]';
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SECRET_KEYS.test(key) ? '[redacted]' : redact(item, depth + 1);
  }
  return out;
}

type Level = 'info' | 'warn' | 'error';

function write(level: Level, message: string, fields?: Record<string, unknown>): void {
  const line = JSON.stringify({ time: new Date().toISOString(), level, message, ...(redact(fields || {}) as object) }, (_k, v) =>
    typeof v === 'bigint' ? v.toString() : v
  );
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const log = {
  info: (message: string, fields?: Record<string, unknown>) => write('info', message, fields),
  warn: (message: string, fields?: Record<string, unknown>) => write('warn', message, fields),
  error: (message: string, fields?: Record<string, unknown>) => write('error', message, fields),
};
