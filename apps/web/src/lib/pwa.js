import { create } from "zustand";

/** Set when a new version of the app has taken over this page (UpdateBar.jsx shows "Update"). */
export const useAppUpdate = create(() => ({ ready: false, apply: null }));

const CHECK_EVERY_MS = 30 * 60 * 1000;
// Within this long after opening the app nothing has been typed yet: reload straight away.
const AUTO_RELOAD_MS = 15_000;
const RELOADED_KEY = "ss_reloaded_for";

const reload = () => window.location.reload();

/**
 * Registers the service worker (production only). A new deploy is downloaded in the background
 * and takes over immediately (vite.config.js: skipWaiting + clientsClaim). If that happens
 * just after the app opened, the page reloads into the new version by itself; later on, the
 * UpdateBar asks first, so nothing typed is lost. Also checks for a new version every 30 minutes
 * and whenever the app comes back to the foreground.
 */
export async function registerPwa() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  const openedAt = Date.now();
  const hadController = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController) return; // first install, nothing old is running
    if (Date.now() - openedAt < AUTO_RELOAD_MS) return reload();
    useAppUpdate.setState({ ready: true, apply: reload });
  });
  try {
    const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    const check = () => registration.update().catch(() => {});
    setInterval(check, CHECK_EVERY_MS);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") check();
    });
  } catch {
    // No service worker (old browser, private mode): the app still works online.
  }
}

/**
 * A screen's code file from an older deploy is gone after an update (Vercel serves only the
 * latest). Reload once to get the new version instead of showing an error.
 */
export function reloadOnStaleChunks() {
  if (typeof window === "undefined") return;
  window.addEventListener("vite:preloadError", (event) => {
    let last = null;
    try {
      last = sessionStorage.getItem(RELOADED_KEY);
    } catch {
      // ignore
    }
    const here = window.location.pathname;
    if (last === here) return; // already tried once for this screen
    event.preventDefault();
    try {
      sessionStorage.setItem(RELOADED_KEY, here);
    } catch {
      // ignore
    }
    reload();
  });
}
