/**
 * Per-client request limit, kept in memory. Good enough for a prototype on a
 * single serverless instance; a real deployment would back this with a store.
 */
const WINDOW_MS = 60_000;
// Batch mode runs four labels at a time at roughly three seconds each, so a
// busy agent legitimately makes 80 or so requests a minute.
const MAX_PER_WINDOW = 150;

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
