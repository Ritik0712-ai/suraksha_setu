import { expect, test } from "@playwright/test";
import { expectAccessible, login } from "./helpers.js";

// Sahayak end to end (docs/03 S-24…S-26) with the real API and AI service. The AI service runs
// the offline "fake" LLM, grounded on the published schemes in the test database.
test.beforeEach(async ({ page }) => {
  await login(page, "citizen");
  await page.goto("/sahayak");
  await expect(page.getByText(/मैं सहायक हूँ/)).toBeVisible();
});

test("scheme question → grounded answer with scheme cards", async ({ page }) => {
  await expectAccessible(page, "S-24");
  // .first(): the start chip comes before "recent chats", which may hold a chat of the same name.
  await page.getByRole("button", { name: "मुझे कौन-सी योजना मिल सकती है?" }).first().click();
  await expect(page.getByText(/यह योजना आपके काम की हो सकती है/)).toBeVisible();
  const view = page.getByRole("link", { name: /^देखें:/ }).first();
  await expect(view).toBeVisible();
  await view.click();
  await expect(page).toHaveURL(/\/schemes\/[a-z0-9-]+$/);
});

test("letter to the Panchayat → printable letter", async ({ page }) => {
  await page.getByRole("button", { name: "पंचायत को पत्र लिखें" }).first().click();
  await expect(page.getByText(/आवेदक का पूरा नाम बताइए/)).toBeVisible();
  await page.getByRole("button", { name: "Sunita Devi" }).click(); // quick reply = profile name
  await expect(page.getByText("समस्या क्या है?")).toBeVisible();
  await page.getByLabel("अपना सवाल लिखें…").fill("हमारे मोहल्ले का हैंडपंप तीन हफ़्ते से खराब है");
  await page.getByRole("button", { name: "भेजें" }).click();
  await page.getByRole("link", { name: "पत्र देखें" }).click();
  await expect(page.getByText("सेवा में,")).toBeVisible();
  await expect(page.getByText(/^दिनांक: \d{2}\/\d{2}\/\d{4}$/)).toBeVisible();
  await expect(page.getByText("महोदिया").first()).toBeVisible(); // place added by the API
  await expect(page.getByRole("button", { name: "प्रिंट / PDF सहेजें" })).toBeVisible();
  await expectAccessible(page, "S-26");
});

test("'bachao' shows the SOS card before anything else", async ({ page }) => {
  await page.getByLabel("अपना सवाल लिखें…").fill("bachao");
  await page.getByRole("button", { name: "भेजें" }).click();
  const card = page.getByRole("alert").filter({ hasText: "क्या आप खतरे में हैं?" });
  await expect(card).toBeVisible();
  await expect(card.getByRole("link", { name: /SOS/ })).toHaveAttribute("href", "/sos");
  await expect(card.getByRole("link", { name: "112 पर कॉल करें" })).toHaveAttribute(
    "href",
    "tel:112",
  );
});
