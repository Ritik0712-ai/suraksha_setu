import { lazy, Suspense, useState } from "react";
import {
  Box,
  Button,
  ButtonBase,
  Chip,
  Drawer,
  IconButton,
  Link,
  MenuItem,
  Paper,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
  useMediaQuery,
} from "@mui/material";
import {
  CheckCircleRounded,
  CloseRounded,
  DirectionsRounded,
  PhoneRounded,
  WarningRounded,
} from "@mui/icons-material";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import C from "../../config/constants.js";
import { apiError } from "../../api/client.js";
import { sosAdminApi } from "../../api/endpoints.js";
import { directionsLink } from "../../lib/geo.js";
import { useLocalized } from "../../lib/localized.js";
import { useSocketEvent, useSocketStatus } from "../../lib/socket.js";
import { sosChipStatus } from "../../lib/sosStatus.js";
import { formatDateTime, timeAgo } from "../../lib/time.js";
import { toast } from "../../stores/toast.js";
import { MapView } from "../../components/ui/MapView.jsx";
import { ResponsiveDialog } from "../../components/ui/ResponsiveDialog.jsx";
import { ErrorCard, ListSkeleton } from "../../components/ui/States.jsx";
import { StatusChip } from "../../components/ui/StatusChip.jsx";
import { SubmitButton } from "../../components/ui/fields.jsx";

const KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY;
const GooglePinsMap = lazy(() => import("../../components/ui/GooglePinsMap.jsx"));
const OPEN = C.sosOpenStatus;
const PIN = { ACTIVE: "#C62828", ACKNOWLEDGED: "#C2410C" };

function LiveIndicator() {
  const { t } = useTranslation("portal");
  const status = useSocketStatus((s) => s.status);
  if (status === "idle") return null;
  const live = status === "live";
  return (
    <Chip
      size="small"
      label={live ? `${t("liveSos.live")} ●` : t("liveSos.reconnecting")}
      sx={{
        bgcolor: live ? "#E6F4E6" : "#FFF8E1",
        color: live ? "#0B6E0B" : "#B45309",
        fontWeight: 700,
      }}
      role="status"
    />
  );
}

function CloseDialog({ open, onClose, onSubmit, busy }) {
  const { t } = useTranslation("portal");
  const [outcome, setOutcome] = useState("");
  const [note, setNote] = useState("");
  return (
    <ResponsiveDialog
      open={open}
      onClose={busy ? undefined : onClose}
      title={t("liveSos.detail.closeTitle")}
      labelId="close-sos-title"
      actions={
        <>
          <Button variant="outlined" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <SubmitButton
            type="button"
            busy={busy}
            disabled={busy || !outcome}
            onClick={() => onSubmit({ outcome, ...(note.trim() ? { note: note.trim() } : {}) })}
          >
            {t("liveSos.detail.close")}
          </SubmitButton>
        </>
      }
    >
      <Stack spacing={2.5} sx={{ pt: 1 }}>
        <TextField
          select
          label={t("liveSos.detail.outcome")}
          value={outcome}
          onChange={(e) => setOutcome(e.target.value)}
          fullWidth
        >
          {C.sosCloseOutcomes.map((o) => (
            <MenuItem key={o} value={o}>
              {t(`liveSos.outcomes.${o}`)}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label={t("liveSos.detail.note")}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          multiline
          minRows={2}
          inputProps={{ maxLength: 500 }}
          fullWidth
        />
      </Stack>
    </ResponsiveDialog>
  );
}

/** A-05 SOS detail (docs/03), shown in a drawer over the live map. */
function SosDetail({ id, onClose }) {
  const { t } = useTranslation("portal");
  const localized = useLocalized();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [closing, setClosing] = useState(false);
  const [phones, setPhones] = useState({});
  const q = useQuery({ queryKey: ["admin", "sos", id], queryFn: () => sosAdminApi.get(id) });
  useSocketEvent("sos:location", (p) => p?.id === id && q.refetch());
  useSocketEvent("sos:updated", (p) => p?.id === id && q.refetch());

  const act = async (fn) => {
    setBusy(true);
    try {
      qc.setQueryData(["admin", "sos", id], await fn());
      qc.invalidateQueries({ queryKey: ["admin", "sos-list"] });
      toast(t("common.updated"));
    } catch (err) {
      toast(apiError(err).message, "error");
    } finally {
      setBusy(false);
      setClosing(false);
    }
  };
  const reveal = async (key, body) => {
    try {
      const { phone } = await sosAdminApi.revealPhone(id, body);
      setPhones((p) => ({ ...p, [key]: phone }));
      return phone;
    } catch (err) {
      toast(apiError(err).message, "error");
      return null;
    }
  };

  if (q.isLoading) return <ListSkeleton rows={4} />;
  if (q.isError)
    return <ErrorCard network={apiError(q.error).network} onRetry={() => q.refetch()} />;
  const s = q.data;
  const open = OPEN.includes(s.status);
  const minutes = Math.max(
    1,
    Math.round(
      ((s.resolvedAt ? new Date(s.resolvedAt) : new Date()) - new Date(s.triggeredAt)) / 60000,
    ),
  );

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h2" sx={{ fontSize: "1.375rem" }}>
          {s.user.name}
        </Typography>
        <IconButton onClick={onClose} aria-label={t("actions.close", { ns: "common" })}>
          <CloseRounded />
        </IconButton>
      </Stack>
      <StatusChip status={sosChipStatus(s.status)} />
      {s.flaggedForReview && (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ color: "#B45309" }}>
          <WarningRounded />
          <Typography variant="body2">{t("liveSos.detail.flagged")}</Typography>
        </Stack>
      )}
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        <Typography sx={{ fontFamily: "monospace" }}>
          {phones.user ?? s.user.maskedPhone}
        </Typography>
        <Button
          variant="contained"
          color="error"
          startIcon={<PhoneRounded />}
          onClick={async () => {
            const phone = phones.user ?? (await reveal("user", { target: "user" }));
            if (phone) window.location.href = `tel:${phone}`;
          }}
        >
          {t("liveSos.detail.callCitizen")}
        </Button>
      </Stack>
      <Box sx={{ display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 2, rowGap: 0.5 }}>
        <Typography color="text.secondary">{t("liveSos.detail.village")}</Typography>
        <Typography>{localized(s.village) || "—"}</Typography>
        <Typography color="text.secondary">{t("liveSos.detail.start")}</Typography>
        <Typography>{formatDateTime(s.triggeredAt)}</Typography>
        <Typography color="text.secondary">{t("liveSos.detail.duration")}</Typography>
        <Typography>{t("liveSos.detail.minutes", { n: minutes })}</Typography>
        <Typography color="text.secondary">{t("liveSos.detail.source")}</Typography>
        <Typography>
          {t(`liveSos.detail.sources.${s.locationSource}`, { defaultValue: s.locationSource })}
          {s.lastAccuracyM ? ` · ${t("liveSos.accuracy", { m: s.lastAccuracyM })}` : ""}
          {s.approximate ? ` · ${t("liveSos.approximate")}` : ""}
        </Typography>
      </Box>
      {s.lastLocation && (
        <>
          <MapView
            center={s.lastLocation}
            accuracyM={s.lastAccuracyM}
            approximate={s.approximate}
            trail={s.trail ?? []}
            height={220}
            showLink={false}
          />
          <Link
            href={directionsLink(s.lastLocation)}
            target="_blank"
            rel="noopener"
            sx={{ display: "inline-flex", gap: 0.5, alignItems: "center" }}
          >
            <DirectionsRounded fontSize="small" /> {t("liveSos.detail.directions")}
          </Link>
        </>
      )}
      <Box>
        <Typography sx={{ fontWeight: 700, mb: 0.5 }}>{t("liveSos.detail.contacts")}</Typography>
        {(s.contacts ?? []).map((c) => (
          <Stack
            key={c.index}
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{ minHeight: 40 }}
          >
            <Typography sx={{ flex: 1 }}>
              {c.name} ({t(`relations.${c.relation}`, { ns: "common" })})
            </Typography>
            {phones[`c${c.index}`] ? (
              <Link href={`tel:${phones[`c${c.index}`]}`}>{phones[`c${c.index}`]}</Link>
            ) : (
              <Button
                size="small"
                onClick={() => reveal(`c${c.index}`, { target: "contact", index: c.index })}
              >
                {t("liveSos.detail.showNumber")}
              </Button>
            )}
          </Stack>
        ))}
      </Box>
      <Box>
        <Typography sx={{ fontWeight: 700, mb: 0.5 }}>{t("liveSos.detail.history")}</Typography>
        {s.acknowledgedBy && (
          <Typography variant="body2">
            {t("liveSos.detail.acknowledgedBy", {
              name: s.acknowledgedBy.name,
              time: formatDateTime(s.acknowledgedAt),
            })}
          </Typography>
        )}
        {s.closedBy && (
          <Typography variant="body2">
            {t("liveSos.detail.closedBy", { name: s.closedBy.name })}
          </Typography>
        )}
        {s.closeOutcome && (
          <Typography variant="body2">{t(`liveSos.outcomes.${s.closeOutcome}`)}</Typography>
        )}
        {s.closeNote && <Typography variant="body2">{s.closeNote}</Typography>}
      </Box>
      {open && (
        <Stack spacing={1}>
          {s.status === "ACTIVE" && (
            <SubmitButton
              type="button"
              busy={busy}
              onClick={() => act(() => sosAdminApi.acknowledge(id))}
            >
              {t("liveSos.detail.acknowledge")}
            </SubmitButton>
          )}
          <Button variant="outlined" color="error" onClick={() => setClosing(true)} disabled={busy}>
            {t("liveSos.detail.close")}
          </Button>
        </Stack>
      )}
      <CloseDialog
        open={closing}
        busy={busy}
        onClose={() => setClosing(false)}
        onSubmit={(body) => act(() => sosAdminApi.close(id, body))}
      />
    </Stack>
  );
}

/** A-04 Live SOS map (docs/03) + A-05 drawer at /portal/sos/:id. */
export default function LiveSosPage() {
  const { t } = useTranslation("portal");
  const localized = useLocalized();
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const desktop = useMediaQuery((th) => th.breakpoints.up("md"));
  const [tab, setTab] = useState("active");
  const socketStatus = useSocketStatus((s) => s.status);
  const [highlight, setHighlight] = useState(null);

  const q = useQuery({
    queryKey: ["admin", "sos-list", tab],
    queryFn: () => sosAdminApi.active(tab === "last24" ? { window: "24h" } : {}),
    // Fallback while the socket is down (docs/03 A-04).
    refetchInterval: socketStatus === "reconnecting" ? 30_000 : false,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "sos-list"] });
  useSocketEvent("sos:new", (p) => {
    setHighlight(p?.id ?? null);
    refresh();
  });
  useSocketEvent("sos:updated", refresh);
  useSocketEvent("socket:reconnected", refresh);
  useSocketEvent("sos:location", (p) =>
    qc.setQueryData(["admin", "sos-list", tab], (list) =>
      Array.isArray(list)
        ? list.map((s) =>
            s.id === p?.id
              ? {
                  ...s,
                  lastLocation: p.lastLocation,
                  lastAccuracyM: p.lastAccuracyM,
                  lastUpdateAt: p.lastUpdateAt,
                }
              : s,
          )
        : list,
    ),
  );

  const list = q.data ?? [];
  const pins = list
    .filter((s) => s.lastLocation && OPEN.includes(s.status))
    .map((s) => ({ id: s.id, ...s.lastLocation, color: PIN[s.status], label: s.user.name }));
  const openDetail = (sid) => navigate(`/portal/sos/${sid}`);

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Typography variant="h1" sx={{ flex: 1 }}>
          {t("liveSos.title")}
        </Typography>
        <LiveIndicator />
      </Stack>
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", md: "3fr 2fr" },
          alignItems: "start",
        }}
      >
        <Paper variant="outlined" sx={{ height: { xs: 280, md: 560 }, overflow: "hidden" }}>
          {KEY ? (
            <Suspense fallback={<Skeleton variant="rectangular" height="100%" />}>
              <GooglePinsMap apiKey={KEY} pins={pins} onPin={openDetail} />
            </Suspense>
          ) : (
            <Stack
              alignItems="center"
              justifyContent="center"
              sx={{ height: "100%", p: 3, textAlign: "center" }}
            >
              <Typography color="text.secondary">{t("liveSos.noKey")}</Typography>
            </Stack>
          )}
        </Paper>
        <Paper variant="outlined" sx={{ p: 1.5 }}>
          <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 1 }}>
            <Tab value="active" label={t("liveSos.tabs.active")} />
            <Tab value="last24" label={t("liveSos.tabs.last24")} />
          </Tabs>
          {q.isLoading && <ListSkeleton />}
          {q.isError && (
            <ErrorCard network={apiError(q.error).network} onRetry={() => q.refetch()} />
          )}
          {q.isSuccess && list.length === 0 && (
            <Stack direction="row" spacing={1} alignItems="center" sx={{ p: 2 }}>
              <CheckCircleRounded color="success" />
              <Typography>{t(tab === "active" ? "liveSos.empty" : "liveSos.emptyDay")}</Typography>
            </Stack>
          )}
          <Stack spacing={1}>
            {list.map((s) => (
              <ButtonBase
                key={s.id}
                onClick={() => openDetail(s.id)}
                sx={{
                  display: "block",
                  textAlign: "left",
                  p: 1.5,
                  borderRadius: 2,
                  border: "2px solid",
                  borderColor: s.status === "ACTIVE" ? "error.main" : "divider",
                  bgcolor:
                    s.id === highlight
                      ? "#FDECEC"
                      : OPEN.includes(s.status)
                        ? "background.paper"
                        : "#F4F6FA",
                  transition: "background-color 1s",
                }}
              >
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  spacing={1}
                  alignItems="center"
                >
                  <Typography sx={{ fontWeight: 700 }}>{s.user.name}</Typography>
                  <StatusChip status={sosChipStatus(s.status)} size="small" />
                </Stack>
                <Typography variant="body2">{localized(s.village) || "—"}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {t("liveSos.started", { ago: timeAgo(s.triggeredAt) })}
                  {s.lastAccuracyM ? ` · ${t("liveSos.accuracy", { m: s.lastAccuracyM })}` : ""}
                </Typography>
              </ButtonBase>
            ))}
          </Stack>
        </Paper>
      </Box>
      <Drawer
        anchor={desktop ? "right" : "bottom"}
        open={Boolean(id)}
        onClose={() => navigate("/portal/sos")}
        PaperProps={{
          sx: { width: desktop ? 440 : "100%", maxHeight: desktop ? "100%" : "92vh", p: 2 },
        }}
      >
        {id && <SosDetail id={id} onClose={() => navigate("/portal/sos")} />}
      </Drawer>
    </Stack>
  );
}
