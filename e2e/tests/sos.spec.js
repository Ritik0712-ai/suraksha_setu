import { expect, expectAccessible, login, newPhone, test } from "./helpers.js";

// SOS end to end (docs/03 S-06/S-07/S-08, A-04/A-05; docs/01 US-04, US-24): countdown → sent →
// the officer's live list shows it → acknowledge → "I am safe".
test("SOS reaches the authority and ends with 'I am safe'", async ({ page, browser }) => {
  const officer = await newPhone(browser);
  await login(officer, "authority");
  await officer.goto("/portal/sos");
  await expect(officer.getByText("अभी कोई चालू SOS नहीं।")).toBeVisible();

  await page.addInitScript(() => (window.__ssExternalLinks = []));
  await login(page, "citizen");
  await page.goto("/sos");
  await expectAccessible(page, "S-06 idle");
  await page.getByRole("button", { name: /^SOS/ }).first().click();
  await expect(page.getByRole("button", { name: "रद्द करें" })).toBeVisible();
  await page.getByRole("button", { name: "अभी भेजें" }).click();
  await expect(page.getByText("SOS चालू है")).toBeVisible();
  await expect(page.getByText("अधिकारी को सूचना दी गई")).toBeVisible();
  // The SMS app opens pre-filled for the saved contact, with the live tracking link.
  const [sms] = await page.evaluate(() => window.__ssExternalLinks);
  expect(sms).toMatch(/^sms:\+919812300000[?&]body=/);
  expect(decodeURIComponent(sms)).toContain("/track/");

  // Real-time: the pin/list item appears on the officer's screen (target < 5 s).
  const started = Date.now();
  await expect(officer.getByText("Sunita Devi").first()).toBeVisible({ timeout: 5_000 });
  test
    .info()
    .annotations.push({ type: "sos-to-portal-ms", description: `${Date.now() - started}` });
  await officer.getByText("Sunita Devi").first().click();
  await officer.getByRole("button", { name: "देख लिया / Acknowledge" }).click();
  await expect(page.getByText(/GP Secretary ने देख लिया/)).toBeVisible();

  await page.getByRole("button", { name: "मैं सुरक्षित हूँ" }).click();
  await page.getByRole("button", { name: "हाँ, मैं सुरक्षित हूँ" }).click();
  await expect(page.getByText("आप सुरक्षित हैं — अच्छा हुआ 🙏")).toBeVisible();
});

test("cancel during the countdown sends nothing", async ({ page }) => {
  await login(page, "citizen");
  await page.goto("/sos");
  await page.getByRole("button", { name: /^SOS/ }).first().click();
  await page.getByRole("button", { name: "रद्द करें" }).click();
  await expect(page.getByText("SOS रद्द")).toBeVisible();
  await expect(page).toHaveURL(/\/sos$/);
});

test("fake call works (S-09)", async ({ page }) => {
  await page.goto("/fake-call");
  await page.getByRole("button", { name: /शुरू/ }).click();
  await expect(page.getByRole("button", { name: /उठा/ })).toBeVisible();
});
