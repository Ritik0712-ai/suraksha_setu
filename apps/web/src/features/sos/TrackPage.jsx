import { Box, Button, Container, Stack, Typography } from "@mui/material";
import {
  CallRounded,
  DirectionsRounded,
  LinkOffRounded,
  VerifiedUserRounded,
} from "@mui/icons-material";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { trackApi } from "../../api/endpoints.js";
import { directionsLink } from "../../lib/geo.js";
import { formatDateTime, timeAgo } from "../../lib/time.js";
import { LogoMark } from "../../components/icons/index.jsx";
import { LanguageToggle } from "../../components/layout/HeaderControls.jsx";
import { MapView } from "../../components/ui/MapView.jsx";
import { ListSkeleton } from "../../components/ui/States.jsx";

/**
 * S-30 Public live location (docs/03 S-30) for emergency contacts. No login, no app chrome.
 * Shows only the first name, location and status — no phone numbers (docs/05 §8, SEC-12).
 */
export default function TrackPage() {
  const { t } = useTranslation("sos");
  const { token } = useParams();
  const q = useQuery({
    queryKey: ["track", token],
    queryFn: () => trackApi.get(token),
    refetchInterval: (query) => (query.state.data?.lastLocation ? 30_000 : false),
    retry: (count, err) => err?.response?.status !== 404 && count < 2,
  });
  const d = q.data;
  const expired = q.error?.response?.status === 404;

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{ px: 2, py: 1, borderBottom: "1px solid", borderColor: "divider" }}
      >
        <LogoMark size={28} />
        <Typography sx={{ fontWeight: 700, flex: 1 }} color="primary">
          {t("appName", { ns: "common" })}
        </Typography>
        <LanguageToggle />
      </Stack>
      <Container component="main" id="main" maxWidth="sm" sx={{ flex: 1, py: 3 }}>
        {q.isLoading && <ListSkeleton />}
        {expired && (
          <Stack spacing={2} alignItems="center" textAlign="center" sx={{ py: 6 }}>
            <LinkOffRounded sx={{ fontSize: 72 }} color="disabled" />
            <Typography variant="h1">{t("track.expired")}</Typography>
          </Stack>
        )}
        {d && !d.lastLocation && (
          <Stack spacing={2} alignItems="center" textAlign="center" sx={{ py: 6 }}>
            <VerifiedUserRounded color="success" sx={{ fontSize: 88 }} />
            <Typography variant="h1" color="success.main">
              {["RESOLVED_SAFE", "FALSE_ALARM"].includes(d.status)
                ? t("track.safe", { name: d.firstName })
                : t("track.closed")}
            </Typography>
            {d.resolvedAt && (
              <Typography>{t("track.safeAt", { time: formatDateTime(d.resolvedAt) })}</Typography>
            )}
          </Stack>
        )}
        {d?.lastLocation && (
          <Stack spacing={2}>
            <Typography variant="h1" color="error.main">
              {t("track.needsHelp", { name: d.firstName })}
            </Typography>
            <MapView
              center={d.lastLocation}
              accuracyM={d.lastAccuracyM}
              approximate={d.approximate}
              trail={d.trail}
              height={300}
              showLink={false} // the directions button below already opens Google Maps
            />
            {d.approximate && (
              <Typography color="warning.main" sx={{ fontWeight: 500 }}>
                {t("track.approximate")}
              </Typography>
            )}
            <Typography color="text.secondary" aria-live="polite">
              {q.isError
                ? t("track.refreshFailed")
                : t("track.lastUpdated", { ago: timeAgo(d.updatedAt) })}
            </Typography>
            <Button
              component="a"
              href="tel:112"
              variant="contained"
              color="error"
              size="large"
              startIcon={<CallRounded />}
            >
              {t("call112")}
            </Button>
            <Button
              component="a"
              href={directionsLink(d.lastLocation)}
              target="_blank"
              rel="noopener"
              variant="outlined"
              startIcon={<DirectionsRounded />}
            >
              {t("track.directions")}
            </Button>
          </Stack>
        )}
        {q.isError && !expired && !d && (
          <Typography role="alert" sx={{ py: 4 }}>
            {t("states.networkError", { ns: "common" })}
          </Typography>
        )}
      </Container>
      <Box component="footer" sx={{ bgcolor: "primary.dark", color: "#fff", px: 2, py: 2 }}>
        <Typography variant="body2">{t("footer.disclaimer", { ns: "common" })}</Typography>
      </Box>
    </Box>
  );
}
