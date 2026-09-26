import { useQuery, useQueryClient } from "@tanstack/react-query";
import { notificationsApi } from "../../api/endpoints.js";
import { useSocketEvent } from "../../lib/socket.js";
import { useSession } from "../../stores/session.js";

/** Unread count for the header bell; refreshed live on notification:new (docs/02 §7.4). */
export function useUnreadCount() {
  const authed = useSession((s) => s.status === "authed");
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: async () => (await notificationsApi.list({ page: 1 })).unread,
    enabled: authed,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });
  useSocketEvent("notification:new", () => {
    if (!authed) return;
    qc.invalidateQueries({ queryKey: ["notifications"] });
  });
  return authed ? (q.data ?? 0) : 0;
}
