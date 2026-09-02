/**
 * Per-client request limit, kept in memory. Good enough for a prototype on a
 * single serverless instance; a real deployment would back this with a store.
 */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 40;

const hits = new Map<string, number[]>();

export function allowRequest(key: string, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  return true;
}
