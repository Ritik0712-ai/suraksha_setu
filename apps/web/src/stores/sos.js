import { create } from "zustand";

/**
 * Hand-off between S-06 (trigger) and S-07 (active):
 *   launch  — the SOS just created: its SMS text, and whether to open the SMS app now
 *   pending — an SOS that couldn't reach the server yet (offline mode; retried every 10 s)
 */
export const useSosStore = create((set) => ({
  launch: null,
  pending: null,
  setLaunch: (launch) => set({ launch }),
  setPending: (pending) => set({ pending }),
  clear: () => set({ launch: null, pending: null }),
}));
