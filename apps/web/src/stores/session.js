import { create } from "zustand";
import { readJSON, writeJSON } from "../lib/storage.js";
import { rememberAccount } from "../lib/knownAccounts.js";

// Id, name + role only, cached so an SOS still works (SMS from the phone) when the server can't be
// reached at app start (docs/02 §1 principle 4). Cleared on logout. No tokens are stored here.
const PROFILE_KEY = "ss_profile";
export const cachedProfile = () => readJSON(PROFILE_KEY, null);

/**
 * Auth session (docs/02 §6.2). The access token lives only in memory, never in localStorage.
 * status: "loading" (initial refresh in flight) | "guest" | "authed" | "expired" (X-04)
 *       | "offline" (a known citizen, but the server couldn't be reached to restore the session).
 */
export const useSession = create((set) => ({
  status: "loading",
  accessToken: null,
  user: null,
  // True after the user logs out or deletes their account: route guards then send them home
  // instead of to /login (docs/03 §2.7 "go to /").
  endedByUser: false,
  setSession({ accessToken, user }) {
    writeJSON(PROFILE_KEY, { id: user.id, name: user.name, role: user.role });
    rememberAccount(user); // "Who is using the phone?" on the login screen
    set({ status: "authed", accessToken, user, endedByUser: false });
  },
  setOffline(profile) {
    set({ status: "offline", accessToken: null, user: profile, endedByUser: false });
  },
  setUser(user) {
    set({ user });
  },
  setGuest({ endedByUser = false } = {}) {
    writeJSON(PROFILE_KEY, null);
    set({ status: "guest", accessToken: null, user: null, endedByUser });
  },
  expire() {
    set((s) => (s.status === "authed" ? { status: "expired", accessToken: null } : s));
  },
}));

export const isStaff = (user) => user?.role === "authority" || user?.role === "admin";

/** Signed in, online or not (use for what to show; use status === "authed" before calling the API). */
export const isSignedIn = (status) => status === "authed" || status === "offline";
