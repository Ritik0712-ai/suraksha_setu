import { lazy, Suspense, useEffect, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import {
  DirectionsRounded,
  FireTruckRounded,
  LocalHospitalRounded,
  LocalPharmacyRounded,
  LocalPoliceRounded,
  MedicalServicesRounded,
  MyLocationRounded,
  PhoneRounded,
  VerifiedRounded,
} from "@mui/icons-material";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiError } from "../../api/client.js";
import { emergencyApi, eventsApi } from "../../api/endpoints.js";
import { directionsLink, formatDistance, getPosition } from "../../lib/geo.js";
import { useLocalized } from "../../lib/localized.js";
import { useNetwork } from "../../stores/network.js";
import { useSession } from "../../stores/session.js";
import { HelplinesGrid } from "../../components/ui/HelplinesGrid.jsx";
import { Notice } from "../../components/ui/Notice.jsx";
import { PageTitle } from "../../components/ui/PageTitle.jsx";
import { ResponsiveDialog } from "../../components/ui/ResponsiveDialog.jsx";
import { ErrorCard } from "../../components/ui/States.jsx";

const LeafletPinsMap = lazy(() => import("../../components/ui/maps/LeafletPinsMap.jsx"));

// docs/03 S-20 tabs.
const TYPES = [
  { type: "hospital", Icon: LocalHospitalRounded },
  { type: "police", Icon: LocalPoliceRounded },
  { type: "ambulance", Icon: MedicalServicesRounded },
  { type: "fire", Icon: FireTruckRounded },
  { type: "pharmacy", Icon: LocalPharmacyRounded },
];

function ServiceCard({ s }) {
  const { t } = useTranslation("emergency");
  const localized = useLocalized();
  const phone = s.phones[0];
  return (
    <Box
      sx={{
        p: 2,
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        bgcolor: "background.paper",
      }}
    >
      <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="flex-start">
        <Typography sx={{ fontWeight: 700 }}>{localized(s.name)}</Typography>
        <Typography sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>
          {formatDistance(t, s.distanceM)}
        </Typography>
      </Stack>
      <Typography color="text.secondary" variant="body2" sx={{ mt: 0.5 }}>
        {localized(s.address)}
      </Typography>
      <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
        {s.source === "curated" ? (
          <Chip
            size="small"
            color="success"
            variant="outlined"
            icon={<VerifiedRounded />}
            label={t("verified")}
          />
        ) : (
          <Chip size="small" variant="outlined" label={t("google")} />
        )}
        {s.is24x7 && <Chip size="small" variant="outlined" label={t("open24")} />}
        {s.notes && <Chip size="small" variant="outlined" label={localized(s.notes)} />}
      </Stack>
      <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
        {phone && (
          <Button
            variant="contained"
            color="error"
            startIcon={<PhoneRounded />}
            href={`tel:${phone.replace(/\s/g, "")}`}
            onClick={() => eventsApi.send("emergency_call_tap", { type: s.type, source: s.source })}
            sx={{ flex: 1 }}
          >
            {t("call")}
          </Button>
        )}
        <Button
          variant="outlined"
          startIcon={<DirectionsRounded />}
          href={directionsLink(s)}
          target="_blank"
          rel="noopener"
          sx={{ flex: 1 }}
        >
          {t("directions")}
        </Button>
      </Stack>
    </Box>
  );
}

/** Location: GPS if allowed; otherwise the home village (signed in) or nothing (guest). */
function useLocation() {
  const [state, setState] = useState({ status: "idle", position: null });
  const locate = async () => {
    setState((s) => ({ ...s, status: "locating" }));
    try {
      setState({ status: "ok", position: await getPosition() });
    } catch (err) {
      setState({ status: err?.denied ? "denied" : "unavailable", position: null });
    }
  };
  // Ask straight away only when permission is already granted (no surprise prompt).
  useEffect(() => {
    let alive = true;
    const perms = navigator.permissions?.query?.({ name: "geolocation" });
    if (!perms) return undefined;
    perms
      .then((p) => {
        if (!alive) return;
        if (p.state === "granted") locate();
        else if (p.state === "denied") setState({ status: "denied", position: null });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return { ...state, locate };
}

/** S-20 Emergency help (docs/03). */
export default function EmergencyPage() {
  const { t } = useTranslation("emergency");
  const localized = useLocalized();
  const signedIn = useSession((s) => s.status === "authed");
  const online = useNetwork((s) => s.browserOnline);
  const [type, setType] = useState("hospital");
  const [view, setView] = useState("list");
  const [selected, setSelected] = useState(null);
  const loc = useLocation();
  const useVillage =
    !loc.position && (loc.status === "denied" || loc.status === "unavailable") && signedIn;
  const canQuery = online && (Boolean(loc.position) || useVillage);

  const q = useQuery({
    queryKey: ["nearby", type, loc.position?.lat, loc.position?.lng, useVillage],
    queryFn: () =>
      emergencyApi.nearby({
        type,
        radiusKm: 50,
        ...(loc.position ? { lat: loc.position.lat, lng: loc.position.lng } : {}),
      }),
    enabled: canQuery,
    staleTime: 5 * 60_000,
  });
  const services = q.data?.services ?? [];
  const typeLabel = t(`types.${type}`);

  return (
    <Stack spacing={3}>
      <PageTitle sx={{ mb: 0 }}>{t("title")}</PageTitle>
      <Box component="section">
        <Typography variant="h2" sx={{ fontSize: "1.25rem", mb: 1.5 }}>
          {t("helplines")}
        </Typography>
        <HelplinesGrid onCall={(number) => eventsApi.send("emergency_call_tap", { number })} />
      </Box>

      <Box component="section">
        <Typography variant="h2" sx={{ fontSize: "1.25rem", mb: 1 }}>
          {t("nearby")}
        </Typography>
        <Tabs
          value={type}
          onChange={(_e, v) => setType(v)}
          variant="scrollable"
          allowScrollButtonsMobile
          aria-label={t("typeLabel")}
          sx={{ mb: 1.5 }}
        >
          {TYPES.map(({ type: v, Icon }) => (
            <Tab
              key={v}
              value={v}
              icon={<Icon />}
              iconPosition="start"
              label={t(`types.${v}`)}
              sx={{ minHeight: 48 }}
            />
          ))}
        </Tabs>

        {!online && <Notice kind="warning">{t("needsInternet")}</Notice>}
        {online && !loc.position && loc.status !== "denied" && loc.status !== "unavailable" && (
          <Notice
            title={t("allowTitle")}
            action={
              <Button
                variant="contained"
                startIcon={<MyLocationRounded />}
                onClick={loc.locate}
                disabled={loc.status === "locating"}
              >
                {loc.status === "locating" ? t("locating") : t("allow")}
              </Button>
            }
          />
        )}
        {online && useVillage && <Notice kind="warning">{t("deniedVillage")}</Notice>}
        {online &&
          !loc.position &&
          !signedIn &&
          (loc.status === "denied" || loc.status === "unavailable") && (
            <Notice kind="warning">{t("deniedGuest")}</Notice>
          )}

        {canQuery && (
          <ToggleButtonGroup
            exclusive
            value={view}
            onChange={(_e, v) => v && setView(v)}
            aria-label={t("view.label")}
            size="small"
            sx={{ my: 1.5 }}
          >
            <ToggleButton value="list">{t("view.list")}</ToggleButton>
            <ToggleButton value="map">{t("view.map")}</ToggleButton>
          </ToggleButtonGroup>
        )}

        {q.isLoading && canQuery && (
          <Stack spacing={1.5} aria-busy="true">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} variant="rounded" height={132} />
            ))}
          </Stack>
        )}
        {q.isError && <ErrorCard network={apiError(q.error).network} onRetry={() => q.refetch()} />}
        {q.isSuccess && services.length === 0 && (
          <Notice
            kind="warning"
            title={t("empty", { type: typeLabel })}
            action={
              <Stack direction="row" spacing={1}>
                <Button variant="contained" color="error" href="tel:112">
                  {t("call112")}
                </Button>
                <Button variant="outlined" color="error" href="tel:108">
                  {t("call108")}
                </Button>
              </Stack>
            }
          />
        )}
        {q.isSuccess && services.length > 0 && view === "map" ? (
          <Box
            sx={{
              height: 360,
              borderRadius: 2,
              overflow: "hidden",
              border: "1px solid",
              borderColor: "divider",
              position: "relative",
              zIndex: 0,
            }}
          >
            <Suspense fallback={<Skeleton variant="rectangular" height={360} />}>
              <LeafletPinsMap
                pins={services.map((s) => ({
                  id: s.id,
                  lat: s.lat,
                  lng: s.lng,
                  label: localized(s.name),
                }))}
                me={q.data.from}
                onPin={(id) => setSelected(services.find((s) => s.id === id) ?? null)}
              />
            </Suspense>
          </Box>
        ) : (
          <Stack component="ul" spacing={1.5} sx={{ listStyle: "none", p: 0, m: 0 }}>
            {services.map((s) => (
              <li key={s.id}>
                <ServiceCard s={s} />
              </li>
            ))}
          </Stack>
        )}
      </Box>
      <ResponsiveDialog
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected ? localized(selected.name) : ""}
        labelId="service-sheet-title"
      >
        {selected && <ServiceCard s={selected} />}
      </ResponsiveDialog>
    </Stack>
  );
}
