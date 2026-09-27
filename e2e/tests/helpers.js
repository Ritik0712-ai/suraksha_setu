import AxeBuilder from "@axe-core/playwright";
import { expect, test as base } from "@playwright/test";
import { ACCOUNTS, CONTEXT, PASSWORD, WEB_PORT, local } from "../accounts.js";

// Every page runs under the production Content-Security-Policy (vite preview sends the headers
// from apps/web/vercel.json). A blocked script, style, image or request fails the test.
const cspViolations = [];

/** Records CSP violations reported by the browser on this page. */
export function watchCsp(page) {
  page.on("console", (msg) => {
    if (msg.type() === "error" && /Content Security Policy/i.test(msg.text()))
      cspViolations.push(`${page.url()} — ${msg.text()}`);
  });
}

export const test = base.extend({
  page: async ({ page }, use) => {
    cspViolations.length = 0;
    watchCsp(page);
    await use(page);
    expect(cspViolations, "Content-Security-Policy violations").toEqual([]);
  },
});
export { expect };

/** Logs in through the real S-03 form (Hindi UI). */
export async function login(page, who = "citizen") {
  await page.goto("/login");
  await page.getByLabel("मोबाइल नंबर").fill(local(ACCOUNTS[who].phone));
  await page.getByLabel("पासवर्ड", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "लॉग इन करें" }).click();
  if (who === "citizen")
    await expect(page.getByRole("heading", { name: /नमस्ते, Sunita/ })).toBeVisible();
  else await expect(page).toHaveURL(/\/portal/);
}

/** WCAG 2.1 A/AA scan (docs/04 §9): no serious or critical violations. */
export async function expectAccessible(page, label) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const bad = violations.filter((v) => ["serious", "critical"].includes(v.impact));
  expect(
    bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`),
    `${label}: accessibility violations`,
  ).toEqual([]);
}

/** A red photo: the E2E test model classifies mostly-red images as road damage. */
export const RED_PHOTO = new URL("../fixtures/red-road.jpg", import.meta.url).pathname;

/** A second person on another phone (e.g. the officer while the citizen stays logged in). */
export async function newPhone(browser) {
  const context = await browser.newContext({ ...CONTEXT, baseURL: `http://localhost:${WEB_PORT}` });
  const page = await context.newPage();
  watchCsp(page);
  return page;
}
