import { expect, test } from "@playwright/test";
import { expectAccessible } from "./helpers.js";

// Schemes browse + detail + eligibility checker (docs/03 S-14…S-17; docs/01 US-13…US-15).
test("browse schemes, open one with its source and last-checked date", async ({ page }) => {
  await page.goto("/schemes");
  await expect(page.getByRole("heading", { level: 1, name: "सरकारी योजनाएं" })).toBeVisible();
  await page.getByLabel(/योजना खोजें/).fill("किसान");
  await page.locator('a[href="/schemes/pm-kisan"]').click();
  await expect(page).toHaveURL(/\/schemes\/pm-kisan$/);
  await expect(page.getByText(/स्रोत/).first()).toBeVisible();
  await expect(page.getByText(/आखिरी जाँच/).first()).toBeVisible();
  await expect(page.getByText("अंतिम पात्रता सरकारी कार्यालय तय करेगा।")).toBeVisible();
  await expectAccessible(page, "S-15");
});

test("eligibility checker: 8 simple questions → grouped results", async ({ page }) => {
  await page.goto("/schemes/check");
  const answer = (label) => page.getByRole("radio", { name: label, exact: true }).click();
  const start = page.getByRole("button", { name: "शुरू करें" });
  if (await start.isVisible()) await start.click();
  await answer("मेरे लिए");
  await answer("महिला");
  await answer("21–40");
  await answer("विवाहित");
  await answer("गृहिणी");
  await answer("₹1 लाख से कम");
  await answer("सामान्य");
  await answer("BPL / अंत्योदय");
  await answer("नहीं");
  await page.getByRole("button", { name: "मेरी योजनाएं देखें" }).click();
  await expect(page).toHaveURL(/\/schemes\/check\/results$/);
  await expect(page.getByRole("heading", { level: 1, name: "आपकी योजनाएं" })).toBeVisible();
  await expect(page.getByText(/शायद पात्र|जाँच करें/).first()).toBeVisible();
  await expectAccessible(page, "S-17");
});
