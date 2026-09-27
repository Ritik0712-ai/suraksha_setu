// Known accounts and ports for the end-to-end tests (created by stack.js; test data only).
export const PASSWORD = "E2e-pass-123";
export const API_PORT = 5055;
export const AI_PORT = 8055;
export const WEB_PORT = 4173;
export const INTERNAL_KEY = "e2e-internal-key";

export const ACCOUNTS = {
  admin: { name: "Admin One", phone: "+919000000001" },
  authority: { name: "GP Secretary", phone: "+919000000101" },
  citizen: { name: "Sunita Devi", phone: "+919876543210" },
};

/** "+919876543210" → "9876543210" (what a person types in the login form). */
export const local = (phone) => phone.replace(/^\+91/, "");

/** Browser context options shared by the config and by tests that need a second person. */
export const CONTEXT = {
  viewport: { width: 360, height: 640 },
  deviceScaleFactor: 2.75,
  isMobile: true,
  hasTouch: true,
  locale: "hi-IN",
  timezoneId: "Asia/Kolkata",
  geolocation: { latitude: 23.2, longitude: 77.08, accuracy: 20 },
  permissions: ["geolocation"],
  serviceWorkers: "block",
  // Hindi already chosen on S-01, so tests start where a returning villager would.
  storageState: {
    cookies: [],
    origins: [
      { origin: `http://localhost:${WEB_PORT}`, localStorage: [{ name: "ss_lang", value: "hi" }] },
    ],
  },
};
