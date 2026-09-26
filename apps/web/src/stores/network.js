import { create } from "zustand";

/**
 * Offline state for the X-03 banner (docs/03 §2.5): offline when the browser says so, or after
 * 2 requests in a row fail with a network error.
 */
export const useNetwork = create((set, get) => ({
  browserOnline: typeof navigator === "undefined" ? true : navigator.onLine,
  failures: 0,
  setBrowserOnline(browserOnline) {
    set({ browserOnline, failures: browserOnline ? 0 : get().failures });
  },
  requestFailed() {
    set({ failures: get().failures + 1 });
  },
  requestOk() {
    if (get().failures) set({ failures: 0 });
  },
}));

export const selectOffline = (s) => !s.browserOnline || s.failures >= 2;

if (typeof window !== "undefined") {
  window.addEventListener("online", () => useNetwork.getState().setBrowserOnline(true));
  window.addEventListener("offline", () => useNetwork.getState().setBrowserOnline(false));
}
