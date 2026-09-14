/**
 * A per-instance, in-memory, per-key sliding-window rate limiter. For
 * anything that shouldn't touch the DB-backed `rateLimit()` in
 * `lib/rate-limit.ts` — e.g. a DB-liveness endpoint, where a limiter that
 * itself queries the DB adds load to every normal check and fails open at
 * exactly the moment a struggling DB makes throttling matter most.
 *
 * A factory, not a singleton: each caller gets its own isolated state (own
 * `Map`), so tests (and any future second caller) don't share counters.
 *
 * `now` is an explicit parameter (defaulting to `Date.now()`) specifically so
 * this is deterministically unit-testable without faking the system clock.
 */
export function createMemoryRateLimiter(opts: {
  max: number;
  windowMs: number;
  /** Hard cap on distinct keys tracked at once — see `evictOldest` below. */
  maxTrackedKeys: number;
}) {
  const hits = new Map<string, number[]>();

  // Evicts the `count` *least-recently-touched* keys. Relies on `isLimited`
  // always doing delete-then-set on every touch (below) — plain `Map.set()`
  // on an existing key does NOT move it in iteration order, so without that,
  // this would evict by first-ever-insertion instead of by staleness, and
  // could delete an entry that's been touched every second since start-up.
  function evictOldest(count: number) {
    const it = hits.keys();
    for (let i = 0; i < count; i++) {
      const next = it.next();
      if (next.done) break;
      hits.delete(next.value);
    }
  }

  function isLimited(key: string, now = Date.now()): boolean {
    const recent = (hits.get(key) ?? []).filter(
      (t) => now - t <= opts.windowMs
    );
    const limited = recent.length >= opts.max;
    if (!limited) recent.push(now);

    // Delete before (maybe) re-setting: this is what makes `key` the most
    // recently touched entry for `evictOldest`'s purposes, and drops it
    // entirely once its window empties out instead of leaving a stale `[]`.
    hits.delete(key);
    if (recent.length) hits.set(key, recent);

    // Only *after* touching `key` — it's now the most-recently-touched entry
    // (last in Map order), so `evictOldest` (which always takes from the
    // front) can never pick it. Checking before that touch could evict `key`
    // itself right before its own lookup, silently wiping the history this
    // call is trying to read.
    if (hits.size > opts.maxTrackedKeys) {
      evictOldest(hits.size - opts.maxTrackedKeys);
    }

    return limited;
  }

  return {
    isLimited,
    _size: () => hits.size,
    /** Read-only peek for tests — never mutates or triggers eviction. */
    _has: (key: string) => hits.has(key),
  };
}
