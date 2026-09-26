import { Box, Button, Stack, Typography } from "@mui/material";
import { BlockRounded, ConstructionRounded, SearchOffRounded } from "@mui/icons-material";
import { Link as RouterLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { isStaff, useSession } from "../../stores/session.js";
import { EmptyState } from "../../components/ui/States.jsx";
import { HelplinesGrid } from "../../components/ui/HelplinesGrid.jsx";

/** X-01 Not found. */
export function NotFoundPage() {
  const { t } = useTranslation("system");
  return (
    <EmptyState
      icon={SearchOffRounded}
      headingLevel={1}
      title={t("notFound")}
      action={
        <Button variant="contained" component={RouterLink} to="/">
          {t("actions.goHome", { ns: "common" })}
        </Button>
      }
    />
  );
}

/** X-02 Permission denied: "Go home" for citizens, "Go to portal" for authorities. */
export function ForbiddenPage() {
  const { t } = useTranslation("system");
  const user = useSession((s) => s.user);
  const staff = isStaff(user);
  return (
    <EmptyState
      icon={BlockRounded}
      headingLevel={1}
      title={t("forbidden")}
      action={
        <Button variant="contained" component={RouterLink} to={staff ? "/portal" : "/"}>
          {staff ? t("goPortal") : t("actions.goHome", { ns: "common" })}
        </Button>
      }
    />
  );
}

/** Placeholder for modules that later phases build. Emergency numbers still work here. */
export function ComingSoonPage({ titleKey }) {
  const { t } = useTranslation();
  return (
    <Stack spacing={3}>
      <EmptyState
        icon={ConstructionRounded}
        headingLevel={1}
        title={titleKey ? t(titleKey) : t("comingSoon.title")}
        body={t("comingSoon.body")}
      />
      <Box>
        <Typography variant="h2" sx={{ mb: 2 }}>
          {t("helplines.title")}
        </Typography>
        <HelplinesGrid />
      </Box>
    </Stack>
  );
}
