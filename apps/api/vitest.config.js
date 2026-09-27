import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Integration tests start a MongoDB replica set per file; give them time to boot.
    hookTimeout: 120_000,
    testTimeout: 30_000,
    env: { NODE_ENV: "test" },
    // `npm run test:coverage` (docs/06 Phase 6: ≥ 60% line coverage on the API). CLI scripts
    // (seeds, index builder) and the process entry point run against a real database only.
    coverage: {
      provider: "v8",
      include: ["src/**/*.js"],
      exclude: ["src/scripts/**", "src/server.js"],
      reporter: ["text-summary", "html"],
      // Doc 06 asks for ≥ 60%; the gate sits just under where we are so a real drop fails CI.
      thresholds: { lines: 85, branches: 75 },
    },
  },
});
