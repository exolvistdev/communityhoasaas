import { defineWorkspace } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// Two suites:
//   unit         — pure functions, no database, always runs
//   integration  — real Postgres via DATABASE_URL_TEST; each test body is
//                  `describe.skipIf(!process.env.DATABASE_URL_TEST)` so the
//                  suite no-ops locally and only runs in CI (or with a scratch DB).
export default defineWorkspace([
  {
    plugins: [tsconfigPaths()],
    test: {
      name: "unit",
      environment: "node",
      include: ["test/unit/**/*.test.ts"],
    },
  },
  {
    plugins: [tsconfigPaths()],
    test: {
      name: "integration",
      environment: "node",
      include: ["test/integration/**/*.test.ts"],
      // DB tests share one Postgres — don't let files race each other.
      fileParallelism: false,
      setupFiles: ["test/integration/setup.ts"],
      hookTimeout: 30_000,
      testTimeout: 30_000,
    },
  },
]);
