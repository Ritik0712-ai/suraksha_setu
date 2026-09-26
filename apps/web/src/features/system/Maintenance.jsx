import { Button, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { healthApi } from "../../api/endpoints.js";
import { HelplinesGrid } from "../../components/ui/HelplinesGrid.jsx";

/**
 * X-06: when /health says the database is down, show the maintenance screen with the
 * helplines instead of pages that can't load. A network failure is the offline banner's job.
 */
export function MaintenanceGate({ children }) {
  const { t } = useTranslation("system");
  const health = useQuery({
    queryKey: ["health"],
    queryFn: healthApi.get,
    staleTime: 60_000,
    retry: false,
  });
  if (health.data?.db !== "down") return children;
  return (
    <Stack spacing={3} role="alert">
      <Typography variant="h1">{t("maintenance")}</Typography>
      <HelplinesGrid />
      <Button variant="contained" onClick={() => health.refetch()} sx={{ alignSelf: "flex-start" }}>
        {t("actions.retry", { ns: "common" })}
      </Button>
    </Stack>
  );
}
