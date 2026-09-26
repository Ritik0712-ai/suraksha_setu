import { Paper, Stack, Typography } from "@mui/material";
import { ConstructionRounded } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { useSession } from "../../stores/session.js";

/** Portal screens A-01…A-14 are built in doc 06 task 4E; this holds their routes until then. */
export default function PortalPlaceholder({ titleKey }) {
  const { t } = useTranslation("portal");
  const user = useSession((s) => s.user);
  return (
    <Stack spacing={2}>
      <Typography variant="h1">
        {titleKey ? t(titleKey) : t("welcome", { name: user?.name ?? "" })}
      </Typography>
      <Paper variant="outlined" sx={{ p: 3, display: "flex", gap: 2, alignItems: "center" }}>
        <ConstructionRounded color="primary" />
        <Typography>{t("comingSoon")}</Typography>
      </Paper>
    </Stack>
  );
}
