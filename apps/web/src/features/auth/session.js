import { authApi } from "../../api/endpoints.js";
import { refreshSession } from "../../api/client.js";
import { queryClient } from "../../lib/queryClient.js";
import { cachedProfile, useSession } from "../../stores/session.js";

const RETRY_MS = 15_000;
let retryTimer = null;

const unreachable = (err) => !err?.response || err.response.status >= 500;

/**
 * On app load: try the refresh cookie; fall back to logged-out silently (docs/03 §2.7).
 * If the *server* can't be reached and this phone belongs to a known citizen, stay signed in
 * offline so SOS still works (SMS from the phone), and keep retrying until the server is back.
 */
export async function bootstrapSession() {
  try {
    await refreshSession();
    clearInterval(retryTimer);
    retryTimer = null;
  } catch (err) {
    const profile = cachedProfile();
    if (unreachable(err) && profile?.role === "citizen") {
      useSession.getState().setOffline(profile);
      if (!retryTimer) {
        retryTimer = setInterval(
          () => useSession.getState().status === "offline" && bootstrapSession(),
          RETRY_MS,
        );
        window.addEventListener(
          "online",
          () => useSession.getState().status === "offline" && bootstrapSession(),
        );
      }
      return;
    }
    clearInterval(retryTimer);
    retryTimer = null;
    useSession.getState().setGuest();
  }
}

/** Re-reads the profile (e.g. after contacts change so the Home setup prompt updates). */
export async function reloadMe() {
  const user = await authApi.me();
  useSession.getState().setUser(user);
  return user;
}

/**
 * Clears everything the logged-in user could see.
 * @param endedByUser  true for logout / account deletion (guards then go home, not to /login)
 */
export function clearClientSession({ endedByUser = false } = {}) {
  useSession.getState().setGuest({ endedByUser });
  queryClient.clear();
}
