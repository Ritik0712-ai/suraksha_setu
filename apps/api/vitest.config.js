import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Integration tests start a MongoDB replica set per file; give them time to boot.
    hookTimeout: 120_000,
    testTimeout: 30_000,
    env: { NODE_ENV: "test" },
  },
});
