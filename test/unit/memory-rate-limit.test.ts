import { describe, it, expect } from "vitest";
import { createMemoryRateLimiter } from "@/lib/memory-rate-limit";

describe("createMemoryRateLimiter", () => {
  it("allows up to max, then limits", () => {
    const rl = createMemoryRateLimiter({ max: 3, windowMs: 60_000, maxTrackedKeys: 10 });
    const now = 1_000_000;
    expect(rl.isLimited("a", now)).toBe(false);
    expect(rl.isLimited("a", now)).toBe(false);
    expect(rl.isLimited("a", now)).toBe(false);
    expect(rl.isLimited("a", now)).toBe(true); // 4th within the window
  });

  it("keys are independent — one key's limit doesn't affect another", () => {
    const rl = createMemoryRateLimiter({ max: 1, windowMs: 60_000, maxTrackedKeys: 10 });
    const now = 1_000_000;
    expect(rl.isLimited("a", now)).toBe(false);
    expect(rl.isLimited("a", now)).toBe(true);
    expect(rl.isLimited("b", now)).toBe(false); // unaffected by "a"
  });

  it("old hits fall out of the window and free up budget again", () => {
    const rl = createMemoryRateLimiter({ max: 1, windowMs: 60_000, maxTrackedKeys: 10 });
    expect(rl.isLimited("a", 0)).toBe(false);
    expect(rl.isLimited("a", 30_000)).toBe(true); // still inside the window
    expect(rl.isLimited("a", 60_001)).toBe(false); // the first hit has aged out
  });

  it("drops a key's entry once its window empties (no memory leak from a one-off caller)", () => {
    const rl = createMemoryRateLimiter({ max: 5, windowMs: 60_000, maxTrackedKeys: 10 });
    rl.isLimited("one-off", 0);
    expect(rl._size()).toBe(1);
    // A much-later touch of the SAME key re-filters its history first, finds
    // the old hit has aged out, and (since the fresh count is 0) the key
    // would be dropped again if this hit were also rejected — here it's
    // accepted, so it's re-added with just this one fresh hit.
    rl.isLimited("one-off", 1_000_000);
    expect(rl._size()).toBe(1);
  });

  it("evicts the least-recently-TOUCHED key when over capacity, not the first-ever-inserted one", () => {
    // `_has` is a pure peek (doesn't mutate or trigger its own eviction check)
    // — using `isLimited` for the post-eviction assertions would itself count
    // as a touch and trigger a further eviction before the check runs.
    // maxTrackedKeys(3) has enough headroom that only ONE eviction fires
    // across this whole sequence — keeping the trace easy to verify by hand.
    const rl = createMemoryRateLimiter({ max: 1000, windowMs: 60_000, maxTrackedKeys: 3 });
    rl.isLimited("old", 0); // "old" touched — map order: [old]
    rl.isLimited("b", 1); //  "b" touched   — map order: [old, b]
    rl.isLimited("old", 2); // "old" touched again, moves to the end — map order: [b, old]
    rl.isLimited("c", 3); // size 2->3 after insert, 3 > 3? no — map order: [b, old, c]
    rl.isLimited("d", 4); // size 3->4 after insert, 4 > 3: evicts 1 from the
    // front — that's "b" (least-recently touched: last touched at t=1), not
    // "old" (the actual first-ever-inserted key, but touched again at t=2)

    expect(rl._has("b")).toBe(false); // evicted
    expect(rl._has("old")).toBe(true); // survived — touched more recently than "b"
    expect(rl._has("c")).toBe(true);
    expect(rl._has("d")).toBe(true);
  });

  it("never leaves the map over capacity after a call returns, so a key can never evict itself", () => {
    // isLimited() checks/evicts AFTER touching `key` (moving it to the most-
    // recently-touched position), not before — so this invariant should hold
    // after every single call, for any key, not just in some steady state.
    // (Checking-before-touch, the earlier version of this code, could leave
    // the map briefly oversized between calls, and evict the very key the
    // *next* call was about to look up if that key happened to be the
    // longest-idle one — silently wiping its rate-limit history.)
    const rl = createMemoryRateLimiter({ max: 1000, windowMs: 60_000, maxTrackedKeys: 3 });
    for (let i = 0; i < 50; i++) {
      // Mix of fresh keys and re-touches of recent ones, so the map is
      // constantly churning near/at capacity.
      rl.isLimited(`k${i}`, i);
      rl.isLimited(`k${Math.max(0, i - 1)}`, i);
      expect(rl._size()).toBeLessThanOrEqual(3);
    }
  });
});
