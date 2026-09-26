import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { apiError } from "../../api/client.js";
import { schemesApi } from "../../api/endpoints.js";
import { useSession } from "../../stores/session.js";
import { toast } from "../../stores/toast.js";

/** Saved-scheme ids + a toggle (logged out → login with a way back; docs/03 S-14). */
export function useSaveScheme() {
  const { t } = useTranslation("schemes");
  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const citizen = useSession((s) => s.status === "authed" && s.user?.role === "citizen");
  const saved = useQuery({
    queryKey: ["saved-schemes"],
    queryFn: schemesApi.saved,
    enabled: citizen,
    staleTime: 60_000,
  });
  const ids = new Set((saved.data ?? []).map((s) => s.id));

  const toggle = useMutation({
    mutationFn: ({ id, on }) => (on ? schemesApi.save(id) : schemesApi.unsave(id)),
    onSuccess: (_d, { on }) => {
      qc.invalidateQueries({ queryKey: ["saved-schemes"] });
      qc.invalidateQueries({ queryKey: ["scheme"] });
      toast(t(on ? "savedToast" : "removedToast"));
    },
    onError: (err) => toast(apiError(err).message, "error"),
  });

  const onToggle = (id) => {
    if (!citizen) {
      toast(t("loginToSave"));
      navigate(`/login?next=${encodeURIComponent(location.pathname + location.search)}`);
      return;
    }
    toggle.mutate({ id, on: !ids.has(id) });
  };

  return { citizen, isSaved: (id) => ids.has(id), onToggle, busy: toggle.isPending };
}
