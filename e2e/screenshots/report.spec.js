import { mkdirSync } from "node:fs";
import { test } from "@playwright/test";
import { login } from "../tests/helpers.js";

const OUT = new URL("../screenshots-out/", import.meta.url).pathname;
const VIEWPORTS = { phone: { width: 360, height: 640 }, desktop: { width: 1366, height: 768 } };

// id → path. Citizen screens need the citizen login; portal screens the authority login.
const PUBLIC = {
  "S-02-home": "/",
  "S-03-login": "/login",
  "S-09-fake-call": "/fake-call",
  "S-14-schemes": "/schemes",
  "S-16-eligibility": "/schemes/check",
  "S-20-emergency": "/emergency",
  "S-31-about": "/about",
};
const CITIZEN = {
  "S-02-home-logged-in": "/",
  "S-06-sos": "/sos",
  "S-10-new-complaint": "/complaints/new",
  "S-12-my-complaints": "/complaints",
  "S-21-blood": "/blood",
  "S-24-sahayak": "/sahayak",
  "S-27-profile": "/profile",
  "S-28-contacts": "/profile/contacts",
};
const PORTAL = {
  "A-01-overview": "/portal",
  "A-02-complaints": "/portal/complaints",
  "A-04-live-sos": "/portal/sos",
  "A-06-analytics": "/portal/analytics",
  "A-08-schemes": "/portal/admin/schemes",
};

async function shoot(page, lang, view, screens) {
  const dir = `${OUT}${lang}/${view}`;
  mkdirSync(dir, { recursive: true });
  for (const [id, path] of Object.entries(screens)) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(400); // fonts and skeleton → content
    await page.screenshot({ path: `${dir}/${id}.png`, fullPage: true });
  }
}

for (const lang of ["hi", "en"])
  for (const [view, viewport] of Object.entries(VIEWPORTS))
    test(`${lang} · ${view}`, async ({ browser }) => {
      const context = await browser.newContext({
        ...test.info().project.use,
        viewport,
        isMobile: view === "phone",
        storageState: {
          cookies: [],
          origins: [
            {
              origin: new URL(test.info().project.use.baseURL).origin,
              localStorage: [{ name: "ss_lang", value: lang }],
            },
          ],
        },
      });
      const page = await context.newPage();
      await shoot(page, lang, view, PUBLIC);
      if (lang === "hi") {
        await login(page, "citizen"); // the helper expects the Hindi form
      } else {
        await page.evaluate(() => localStorage.setItem("ss_lang", "hi"));
        await login(page, "citizen");
        await page.evaluate(() => localStorage.setItem("ss_lang", "en"));
      }
      await shoot(page, lang, view, CITIZEN);
      await context.clearCookies();
      await page.evaluate(() => localStorage.setItem("ss_lang", "hi"));
      await login(page, "admin");
      if (lang === "en") await page.evaluate(() => localStorage.setItem("ss_lang", "en"));
      await shoot(page, lang, view, PORTAL);
      await context.close();
    });
