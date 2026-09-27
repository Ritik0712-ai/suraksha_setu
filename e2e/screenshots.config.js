import base from "./playwright.config.js";

// `npm run screenshots` — key screens in Hindi and English, phone (360 × 640) and desktop
// (1366 × 768), for the Phase I/II reports and the final report (doc 06 task 8.8, doc 04 §14).
// Same stack as the E2E tests (seeded database, test AI model, offline LLM). Output:
// e2e/screenshots-out/<hi|en>/<phone|desktop>/<screen>.png (git-ignored).
export default {
  ...base,
  testDir: "./screenshots",
  outputDir: "./screenshots-out/.results",
  reporter: "list",
  retries: 0,
  timeout: 120_000,
};
