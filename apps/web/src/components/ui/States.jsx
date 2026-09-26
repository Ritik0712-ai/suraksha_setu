import { useEffect, useState } from "react";
import { Box, Button, Skeleton, Stack, Typography } from "@mui/material";
import { CloudOffRounded, ReportProblemRounded } from "@mui/icons-material";
import { useTranslation } from "react-i18next";

/** Empty state (docs/04 §6.6): 96 px icon in a navy-100 circle, H3, one sentence, one button. */
export function EmptyState({ icon: Icon, title, body, action, headingLevel = 2 }) {
  return (
    <Stack alignItems="center" spacing={2} sx={{ py: 5, px: 2, textAlign: "center" }}>
      <Box
        sx={{
          width: 128,
          height: 128,
          borderRadius: "50%",
          bgcolor: "primary.light",
          color: "primary.main",
          display: "grid",
          placeItems: "center",
        }}
      >
        <Icon sx={{ fontSize: 72 }} />
      </Box>
      <Typography variant={headingLevel === 1 ? "h2" : "h3"} component={`h${headingLevel}`}>
        {title}
      </Typography>
      {body && <Typography color="text.secondary">{body}</Typography>}
      {action}
    </Stack>
  );
}

/** Error card for network / server failures (docs/03 §0.2). Keeps whatever else is on screen. */
export function ErrorCard({ network = false, onRetry }) {
  const { t } = useTranslation();
  const Icon = network ? CloudOffRounded : ReportProblemRounded;
  return (
    <Stack
      role="alert"
      direction="row"
      spacing={2}
      alignItems="center"
      sx={{ p: 2, border: "1px solid", borderColor: "divider", borderRadius: 2 }}
    >
      <Icon color="error" />
      <Typography sx={{ flex: 1 }}>
        {t(network ? "states.networkError" : "states.serverError")}
      </Typography>
      {onRetry && (
        <Button variant="outlined" size="small" onClick={onRetry}>
          {t("actions.retry")}
        </Button>
      )}
    </Stack>
  );
}

/** Skeleton rows shaped like list cards, with the "taking longer" note after 10 s. */
export function ListSkeleton({ rows = 3, onRetry }) {
  const { t } = useTranslation();
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setSlow(true), 10_000);
    return () => clearTimeout(id);
  }, []);
  return (
    <Stack spacing={1.5} aria-busy="true">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} variant="rounded" height={72} animation="wave" />
      ))}
      {slow && (
        <Stack direction="row" spacing={2} alignItems="center">
          <Typography color="text.secondary">{t("states.slow")}</Typography>
          {onRetry && (
            <Button size="small" onClick={onRetry}>
              {t("actions.retry")}
            </Button>
          )}
        </Stack>
      )}
    </Stack>
  );
}

/** Shown while a lazy route's code downloads on the very first page load (slow networks). */
export function RouteSkeleton() {
  return (
    <Box sx={{ p: 2 }}>
      <ListSkeleton />
    </Box>
  );
}
