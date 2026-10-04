import { useState } from "react";
import { Button, Paper, Stack, Typography } from "@mui/material";
import { SystemUpdateAltRounded } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { useAppUpdate } from "../../lib/pwa.js";

/**
 * "New version available — Update" (feature: phones kept running an old build after deploys).
 * Stays until tapped; one tap switches to the new version and reloads. Sits above the bottom
 * navigation on phones.
 */
export function UpdateBar() {
  const { t } = useTranslation("common");
  const { ready, apply } = useAppUpdate();
  const [busy, setBusy] = useState(false);
  if (!ready) return null;
  return (
    <Paper
      role="status"
      elevation={6}
      sx={{
        position: "fixed",
        left: 16,
        right: 16,
        bottom: { xs: "calc(88px + env(safe-area-inset-bottom))", md: 24 },
        mx: "auto",
        maxWidth: 560,
        p: 1.5,
        pl: 2,
        zIndex: (th) => th.zIndex.snackbar,
        bgcolor: "primary.main",
        color: "#fff",
        "@media print": { display: "none" },
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center">
        <SystemUpdateAltRounded aria-hidden />
        <Typography sx={{ flex: 1, color: "#fff" }}>{t("update.message")}</Typography>
        <Button
          variant="contained"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            apply?.();
          }}
          sx={{ bgcolor: "#fff", color: "primary.main", "&:hover": { bgcolor: "#E8EEF6" } }}
        >
          {t("update.button")}
        </Button>
      </Stack>
    </Paper>
  );
}
