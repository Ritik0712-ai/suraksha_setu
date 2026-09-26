import { Button } from "@mui/material";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSession } from "../../stores/session.js";
import { clearClientSession } from "../auth/session.js";
import { ResponsiveDialog } from "../../components/ui/ResponsiveDialog.jsx";

/** X-04: the refresh failed mid-session → "Please log in again" → /login?next=<current>. */
export function SessionExpiredDialog() {
  const { t } = useTranslation("system");
  const status = useSession((s) => s.status);
  const navigate = useNavigate();
  const location = useLocation();
  const logIn = () => {
    const next = `${location.pathname}${location.search}`;
    clearClientSession();
    navigate(`/login?next=${encodeURIComponent(next)}`);
  };
  return (
    <ResponsiveDialog
      open={status === "expired"}
      title={t("sessionExpired")}
      labelId="session-expired-title"
      actions={
        <Button variant="contained" onClick={logIn} autoFocus>
          {t("actions.logIn", { ns: "common" })}
        </Button>
      }
    >
      {t("sessionExpiredBody")}
    </ResponsiveDialog>
  );
}
