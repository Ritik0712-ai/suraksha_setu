import { authApi } from "../../api/endpoints.js";
import { refreshSession } from "../../api/client.js";
import { queryClient } from "../../lib/queryClient.js";
import { useSession } from "../../stores/session.js";

/** On app load: try the refresh cookie; fall back to logged-out silently (docs/03 §2.7). */
export async function bootstrapSession() {
  try {
    await refreshSession();
  } catch {
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
