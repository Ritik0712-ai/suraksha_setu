import { useQuery } from "@tanstack/react-query";
import { jurisdictionsApi } from "../../api/endpoints.js";

/** Active villages for the pickers (tiny list, cached for 10 minutes). */
export function useVillages() {
  return useQuery({
    queryKey: ["jurisdictions", "village"],
    queryFn: () => jurisdictionsApi.search({ type: "village" }),
    staleTime: 10 * 60_000,
  });
}
