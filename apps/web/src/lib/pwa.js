import { create } from "zustand";

/** Set when a new version of the app has been downloaded and is waiting (UpdateBar.jsx). */
export const useAppUpdate = create(() => ({ ready: false, apply: null }));

const CHECK_EVERY_MS = 30 * 60 * 1000;

/**
 * Registers the service worker (production only). A new deploy is fetched in the background;
 * when it's ready the UpdateBar asks "New version available — Update", and one tap reloads into
 * it. Also checks for a new version every 30 minutes and whenever the app comes back to the
 * foreground (people leave the PWA open for days).
 */
export async function registerPwa() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const { registerSW } = await import("virtual:pwa-register");
    const updateSW = registerSW({
      onNeedRefresh() {
        useAppUpdate.setState({ ready: true, apply: () => updateSW(true) });
      },
      onRegisteredSW(_url, registration) {
        if (!registration) return;
        const check = () => registration.update().catch(() => {});
        setInterval(check, CHECK_EVERY_MS);
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") check();
        });
      },
    });
  } catch {
    // No service worker (old browser, private mode): the app still works online.
  }
}
