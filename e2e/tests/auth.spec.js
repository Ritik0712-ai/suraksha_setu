import { ACCOUNTS, local } from "../accounts.js";
import { expect, expectAccessible, login, test } from "./helpers.js";

// Login / refresh (docs/03 S-03, §2.7; docs/06 Phase 6 E2E list).
test.describe("login and session", () => {
  test("wrong password shows the error without saying which part is wrong", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("मोबाइल नंबर").fill(local(ACCOUNTS.citizen.phone));
    await page.getByLabel("पासवर्ड", { exact: true }).fill("not-the-password");
    await page.getByRole("button", { name: "लॉग इन करें" }).click();
    await expect(page.getByText("मोबाइल नंबर या पासवर्ड गलत है।")).toBeVisible();
  });

  test("citizen logs in, stays logged in after a reload (refresh cookie), logs out", async ({
    page,
  }) => {
    await login(page, "citizen");
    await page.reload();
    await expect(page.getByRole("heading", { name: /नमस्ते, Sunita/ })).toBeVisible();
    await page.goto("/profile");
    await page.getByRole("button", { name: "लॉग आउट", exact: true }).click();
    await expect(page.getByText("लॉग आउट हो गए")).toBeVisible();
    await page.goto("/profile");
    await expect(page).toHaveURL(/\/login\?next=%2Fprofile/);
  });

  test("an authority goes to the portal; portal screens pass the accessibility scan", async ({
    page,
  }) => {
    await login(page, "authority");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    for (const path of ["/portal", "/portal/complaints", "/portal/sos", "/portal/analytics"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await expectAccessible(page, path);
    }
  });

  test("public screens pass the accessibility scan", async ({ page }) => {
    for (const path of ["/", "/login", "/emergency", "/schemes", "/fake-call"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await expectAccessible(page, path);
    }
  });
});
