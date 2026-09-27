import { expect, login, test } from "./helpers.js";

// Phase 8 checks (docs/06 8.2, 8.5): the largest text size on the smallest phone, and the
// offline promises of docs/03 §2.5.

const noSideScroll = (page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

test.describe("text size A+ on a 360 px phone (docs/04 §4.2, §8)", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("ss_text_size", "lg"));
  });

  test("public screens never scroll sideways", async ({ page }) => {
    for (const path of ["/", "/login", "/register", "/schemes", "/schemes/check", "/emergency"]) {
      await page.goto(path);
      await expect(page.locator("html")).toHaveAttribute("data-text-size", "lg");
      await expect(page.locator("main")).toBeVisible();
      await page.waitForLoadState("networkidle");
      expect(await noSideScroll(page), `${path} scrolls sideways at A+`).toBe(true);
    }
    // A scheme detail page (long Hindi headings and lists)
    await page.goto("/schemes");
    await page
      .getByRole("link", { name: /आयुष्मान भारत/ })
      .first()
      .click();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await noSideScroll(page), "S-15 scrolls sideways at A+").toBe(true);
  });

  test("citizen screens never scroll sideways", async ({ page }) => {
    await login(page, "citizen");
    for (const path of [
      "/",
      "/complaints",
      "/complaints/new",
      "/sahayak",
      "/profile",
      "/profile/contacts",
      "/blood",
      "/blood/donor",
      "/notifications",
      "/my-schemes",
    ]) {
      await page.goto(path);
      await expect(page.locator("main")).toBeVisible();
      await page.waitForLoadState("networkidle");
      expect(await noSideScroll(page), `${path} scrolls sideways at A+`).toBe(true);
    }
  });
});

test.describe("offline (docs/03 §2.5, doc 06 8.5)", () => {
  // The service worker is what makes the app open without a network.
  test.use({ serviceWorkers: "allow" });

  test("after one visit, the app shell, helplines and fake call work offline", async ({
    page,
    context,
  }) => {
    await page.goto("/");
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload(); // now controlled by the service worker
    await page.evaluate(() => navigator.serviceWorker.ready);

    await context.setOffline(true);

    await page.goto("/emergency");
    await expect(page.getByRole("link", { name: /112/ }).first()).toBeVisible();
    await expect(page.getByText("108").first()).toBeVisible();
    await expect(page.getByText(/ऑफ़लाइन/).first()).toBeVisible(); // offline banner

    await page.goto("/fake-call");
    await page.getByRole("button", { name: /शुरू/ }).click();
    await expect(page.getByRole("button", { name: /उठा/ })).toBeVisible();

    await page.goto("/");
    await expect(page.getByRole("link", { name: "आपातकाल? 112 पर कॉल करें" })).toBeVisible();

    await context.setOffline(false);
  });
});
