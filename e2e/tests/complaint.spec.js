import { expect, test } from "@playwright/test";
import { RED_PHOTO, expectAccessible, login, newPhone } from "./helpers.js";

// Complaint with and without AI, then the authority takes it to RESOLVED and the citizen sees
// it (docs/03 S-10…S-13, A-02/A-03; docs/01 FR-CMP-01…07).

async function fileWithPhoto(page) {
  await page.goto("/complaints/new");
  await page.locator('input[type="file"]').first().setInputFiles(RED_PHOTO);
  await page.getByRole("button", { name: "आगे" }).click();
  // The 2 KB test model calls a mostly red photo "road damage".
  await expect(page.getByText("AI के अनुसार: सड़क / गड्ढा")).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "हाँ, सही है" }).click();
}

async function detailsAndSubmit(page, landmark) {
  await expect(page.getByRole("heading", { name: "समस्या कहाँ है?" })).toBeVisible();
  await page.getByLabel("पास की पहचान (वैकल्पिक)").fill(landmark);
  await page.getByRole("button", { name: "आगे" }).click();
  await expect(page.getByText("आपकी शिकायत यहाँ जाएगी:")).toBeVisible();
  await expectAccessible(page, "S-10 review");
  await page.getByRole("button", { name: "शिकायत भेजें" }).click();
  await expect(page.getByText("शिकायत दर्ज हो गई!")).toBeVisible();
  const number = await page.getByText(/^SS-\d{4}-\d{6}$/).textContent();
  expect(number).toMatch(/^SS-\d{4}-\d{6}$/);
  return number;
}

test("citizen files a complaint with an AI-suggested category; authority resolves it", async ({
  page: citizen,
  browser,
}) => {
  await login(citizen, "citizen");
  await fileWithPhoto(citizen);
  const number = await detailsAndSubmit(citizen, "प्राथमिक स्कूल के पास");

  // Authority: A-02 → A-03, every step of doc 05 §5.6.1 up to RESOLVED.
  const officer = await newPhone(browser);
  await login(officer, "authority");
  await officer.goto("/portal/complaints");
  await officer.getByText(number).first().click();
  await expect(officer.getByText(/AI: सड़क \/ गड्ढा/)).toBeVisible();
  await officer.getByRole("button", { name: "जाँचें (Verify)" }).click();
  await officer.getByRole("button", { name: "विभाग को सौंपें" }).click();
  await officer.getByRole("dialog").getByRole("button", { name: "विभाग को सौंपें" }).click();
  await officer.getByRole("button", { name: "काम शुरू (In progress)" }).click();
  await officer.getByRole("button", { name: "हल हो गई" }).click();
  const dialog = officer.getByRole("dialog");
  await dialog.getByLabel("नागरिक के लिए नोट (ज़रूरी)").fill("सड़क की मरम्मत 2 अक्टूबर को हुई");
  await dialog.getByRole("button", { name: "हल हो गई" }).click();
  await expect(officer.getByText("कोई कार्रवाई नहीं", { exact: false })).toBeVisible();

  // Citizen sees the resolved timeline with the public note (S-13).
  await citizen.goto("/complaints");
  await citizen.getByText(number).click();
  await expect(citizen.getByText("सड़क की मरम्मत 2 अक्टूबर को हुई")).toBeVisible();
  await expect(citizen.getByRole("button", { name: /दोबारा खोलें|Reopen/ })).toBeVisible();
});

test("citizen files a complaint without a photo (manual category)", async ({ page }) => {
  await login(page, "citizen");
  await page.goto("/complaints/new");
  await page.getByRole("button", { name: "बिना फ़ोटो के शिकायत करें" }).click();
  await page.getByRole("radio", { name: "पानी / हैंडपंप" }).click();
  await page.getByRole("button", { name: "आगे" }).click();
  await detailsAndSubmit(page, "पंचायत भवन के सामने");
});
