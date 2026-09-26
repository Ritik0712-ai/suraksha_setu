import { Button, IconButton, Stack, Typography } from "@mui/material";
import { CheckCircleRounded, ContentCopyRounded } from "@mui/icons-material";
import { Link as RouterLink, Navigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { copyText } from "../../lib/device.js";
import { toast } from "../../stores/toast.js";

/** S-11 Complaint submitted (docs/03). Direct visits without state go to the list. */
export default function ComplaintSuccessPage() {
  const { t } = useTranslation("complaints");
  const { state } = useLocation();
  if (!state?.complaintNo) return <Navigate to="/complaints" replace />;

  const copy = async () => {
    if (await copyText(state.complaintNo)) toast(t("success.copied"));
  };

  return (
    <Stack
      spacing={3}
      alignItems="center"
      textAlign="center"
      sx={{ py: 4, maxWidth: 520, mx: "auto" }}
    >
      <CheckCircleRounded color="success" sx={{ fontSize: 96 }} />
      <Typography variant="h1">{t("success.title")}</Typography>
      <Stack spacing={0.5} alignItems="center">
        <Typography color="text.secondary">{t("success.numberLabel")}</Typography>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography
            sx={{ fontSize: "1.75rem", fontWeight: 700, letterSpacing: 1, color: "primary.main" }}
          >
            {state.complaintNo}
          </Typography>
          <IconButton onClick={copy} aria-label={t("success.copy")} sx={{ width: 48, height: 48 }}>
            <ContentCopyRounded />
          </IconButton>
        </Stack>
      </Stack>
      <Typography>{t("success.notify")}</Typography>
      <Stack spacing={1.5} sx={{ width: "100%" }}>
        <Button variant="contained" component={RouterLink} to={`/complaints/${state.id}`} replace>
          {t("success.view")}
        </Button>
        <Button variant="outlined" component={RouterLink} to="/complaints/new" replace>
          {t("success.another")}
        </Button>
        <Button component={RouterLink} to="/">
          {t("actions.goHome", { ns: "common" })}
        </Button>
      </Stack>
    </Stack>
  );
}
