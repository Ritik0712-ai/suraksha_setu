import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { usersApi } from "../../api/endpoints.js";
import { STORAGE_KEYS, writeJSON } from "../../lib/storage.js";
import { useSession } from "../../stores/session.js";

/**
 * Keeps the emergency contacts cached on the device so an SOS can still open the SMS app with
 * them when the server can't be reached (doc 06 task 4A.9, docs/03 S-06 step 4).
 */
export function useContactsCache() {
  const isCitizen = useSession((s) => s.status === "authed" && s.user?.role === "citizen");
  const q = useQuery({
    queryKey: ["contacts"],
    queryFn: usersApi.contacts,
    enabled: isCitizen,
    staleTime: 5 * 60_000,
  });
  useEffect(() => {
    if (q.data) writeJSON(STORAGE_KEYS.contacts, q.data);
  }, [q.data]);
  useEffect(() => {
    // Logged out: don't leave someone else's contacts on a shared phone.
    if (useSession.getState().status === "guest") writeJSON(STORAGE_KEYS.contacts, null);
  }, [isCitizen]);
}
