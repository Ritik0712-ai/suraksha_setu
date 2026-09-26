import { create } from "zustand";

/**
 * Auth session (docs/02 §6.2). The access token lives only in memory, never in localStorage.
 * status: "loading" (initial refresh in flight) | "guest" | "authed" | "expired" (X-04).
 */
export const useSession = create((set) => ({
  status: "loading",
  accessToken: null,
  user: null,
  // True after the user logs out or deletes their account: route guards then send them home
  // instead of to /login (docs/03 §2.7 "go to /").
  endedByUser: false,
  setSession({ accessToken, user }) {
    set({ status: "authed", accessToken, user, endedByUser: false });
  },
  setUser(user) {
    set({ user });
  },
  setGuest({ endedByUser = false } = {}) {
    set({ status: "guest", accessToken: null, user: null, endedByUser });
  },
  expire() {
    set((s) => (s.status === "authed" ? { status: "expired", accessToken: null } : s));
  },
}));

export const isStaff = (user) => user?.role === "authority" || user?.role === "admin";
