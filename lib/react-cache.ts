import { cache as reactCache } from "react";

/**
 * `cache()` from "react" only exists under Next's RSC build condition — the
 * public npm "react" package's default export omits it (its `exports` map
 * only wires `cache` under the "react-server" condition, resolving to
 * react.shared-subset.js; plain Node module resolution gets index.js, which
 * doesn't have it). Outside that condition — e.g. these lib files imported
 * directly by the Vitest integration suite, which uses plain Node resolution
 * — `cache` is undefined. Fall back to an uncached passthrough there: those
 * callers invoke the wrapped function directly, not through an actual
 * request/render, so there's nothing to dedupe anyway.
 */
export function requestCache<T extends (...args: never[]) => unknown>(fn: T): T {
  return typeof reactCache === "function" ? reactCache(fn) : fn;
}
