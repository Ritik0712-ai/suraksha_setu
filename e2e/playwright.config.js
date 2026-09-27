import { defineConfig } from "@playwright/test";
import { API_PORT, CONTEXT, WEB_PORT } from "./accounts.js";

// End-to-end tests (docs/06 Phase 6): the real web build, API, database and AI service, on a
// 360 × 640 phone viewport in Hindi. Run with `npm run e2e` (see e2e/README.md).
export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1, // one shared database; tests create their own data where it matters
  retries: process.env.CI ? 1 : 0,
  outputDir: "./test-results",
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never", outputFolder: "./playwright-report" }]]
    : "list",
  use: {
    ...CONTEXT,
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: process.env.E2E_CHROMIUM ? { executablePath: process.env.E2E_CHROMIUM } : {},
  },
  projects: [{ name: "mobile-chromium", use: { browserName: "chromium" } }],
  webServer: [
    {
      command: "node e2e/stack.js",
      cwd: "..",
      url: `http://localhost:${API_PORT}/api/v1/health`,
      timeout: 180_000,
      reuseExistingServer: !process.env.CI,
      stdout: "pipe",
    },
    {
      command: `npm run build -w apps/web && npm run preview -w apps/web -- --port ${WEB_PORT} --strictPort`,
      cwd: "..",
      env: { VITE_PROXY_TARGET: `http://localhost:${API_PORT}` },
      url: `http://localhost:${WEB_PORT}`,
      timeout: 180_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
