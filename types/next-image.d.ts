// `next-env.d.ts` normally supplies this reference, but it's gitignored and
// only generated as a side effect of `next dev` / `next build` / `next lint`.
// CI's "types · lint · unit tests" job runs `tsc --noEmit` directly, before
// any of those — without this, static image imports (e.g. the marketing
// screenshots under public/marketing/*.png) fail to type-check there even
// though they pass locally, where next-env.d.ts already exists on disk.
/// <reference types="next/image-types/global" />
