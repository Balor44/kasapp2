/**
 * Parses the CORS_ORIGINS environment variable, a comma separated list such as
 * "https://mykasapp.com,https://www.mykasapp.com". Returns null when unset,
 * which keeps the previous behaviour (allow any origin).
 */
export function parseAllowedOrigins(raw: string | undefined): string[] | null {
  if (!raw) return null;
  const origins = raw
    .split(',')
    .map((item) => item.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  return origins.length > 0 ? origins : null;
}
