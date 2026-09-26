import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { authApi } from "../../api/endpoints.js";
import { toast } from "../../stores/toast.js";
import { clearClientSession } from "./session.js";

/** Logout (docs/03 §2.7): revoke the session, clear memory + query cache, go home, toast. */
export function useLogout({ all = false } = {}) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  return useCallback(async () => {
    try {
      await (all ? authApi.logoutAll() : authApi.logout());
    } catch {
      // Even if the server can't be reached, forget the session on this device.
    }
    clearClientSession({ endedByUser: true });
    navigate("/", { replace: true });
    toast(t("toast.loggedOut"));
  }, [all, navigate, t]);
}
