import { useQuery } from "@tanstack/react-query";
import { feedbackApi } from "../api/endpoints.js";
import { useSession } from "../stores/session.js";

export const feedbackKey = (target, ids) => ["feedback", target, [...ids].sort().join(",")];

/** The signed-in person's 👍/👎 for the items on screen: { [id]: true | false }. */
export function useMyFeedback(target, ids) {
  const authed = useSession((s) => s.status === "authed");
  const list = ids.filter(Boolean);
  return useQuery({
    queryKey: feedbackKey(target, list),
    queryFn: () => feedbackApi.mine(target, list.slice(-50)),
    enabled: authed && list.length > 0,
    staleTime: Infinity,
  });
}
