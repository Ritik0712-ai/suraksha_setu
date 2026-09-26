import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, Button, Collapse, Link, Stack, Typography } from "@mui/material";
import {
  CallRounded,
  CheckCircleRounded,
  ContentCopyRounded,
  HourglassTopRounded,
  SmsRounded,
  VerifiedUserRounded,
  WarningAmberRounded,
} from "@mui/icons-material";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link as RouterLink, Navigate, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { refreshSession } from "../../api/client.js";
import { sosApi } from "../../api/endpoints.js";
import { useSession } from "../../stores/session.js";
import { getPosition } from "../../lib/geo.js";
import { copyText, keepScreenOn, openExternal, smsHref, whatsappHref } from "../../lib/device.js";
import { useSocketEvent } from "../../lib/socket.js";
import { timeAgo } from "../../lib/time.js";
import { useSosStore } from "../../stores/sos.js";
import { toast } from "../../stores/toast.js";
import { MapView } from "../../components/ui/MapView.jsx";
import { ListSkeleton } from "../../components/ui/States.jsx";
import { ResponsiveDialog } from "../../components/ui/ResponsiveDialog.jsx";
import { postSos } from "./sendSos.js";

const LOCATION_EVERY_MS = 30_000; // docs/01 FR-SOS-05
const RETRY_EVERY_MS = 10_000; // docs/03 S-06 step 4
const RETRY_FOR_MS = 2 * 60_000;
const OPEN = ["ACTIVE", "ACKNOWLEDGED"];

function Step({ ok, warn, children, action }) {
  const Icon = warn ? WarningAmberRounded : ok ? CheckCircleRounded : HourglassTopRounded;
  const color = warn ? "warning.main" : ok ? "success.main" : "text.secondary";
  return (
    <Stack component="li" direction="row" spacing={1.5} alignItems="flex-start" sx={{ py: 1 }}>
      <Icon sx={{ color, mt: 0.25 }} />
      <Box sx={{ flex: 1 }}>
        <Typography>{children}</Typography>
        {action}
      </Box>
    </Stack>
  );
}

/** Re-renders every `ms` so "2 min ago" stays true. */
function useTick(ms) {
  const [, set] = useState(0);
  useEffect(() => {
    const id = setInterval(() => set((x) => x + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}

/**
 * S-07 SOS active (docs/03 S-07). `/sos/offline` is the same screen in offline mode: the SOS
 * couldn't reach the server yet, so it retries every 10 s for 2 minutes.
 */
export default function SosActivePage() {
  const { t } = useTranslation("sos");
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const offline = id === "offline";
  const launch = useSosStore((s) => s.launch);
  const pending = useSosStore((s) => s.pending);
  const setLaunch = useSosStore((s) => s.setLaunch);
  const setPending = useSosStore((s) => s.setPending);
  const [smsState, setSmsState] = useState("idle"); // idle | opened | failed
  const [confirmSafe, setConfirmSafe] = useState(false);
  const [closedByAuthority, setClosedByAuthority] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const queued = useRef([]);
  useTick(15_000);

  const query = useQuery({
    queryKey: ["sos", id],
    queryFn: () => sosApi.get(id),
    enabled: !offline,
    refetchInterval: 20_000, // picks up the email count; sockets cover the rest
  });
  const sos = query.data;
  const sms = useMemo(() => {
    if (offline) return pending?.sms;
    if (sos) return { recipients: sos.smsRecipients, body: sos.smsBody };
    return launch?.sms;
  }, [offline, pending, sos, launch]);

  // --- open the SMS app once, right after sending (docs/03 S-06 step 3) ----------------------
  const openSms = useCallback(() => {
    if (!sms?.recipients?.length) return;
    let left = false;
    const onHide = () => {
      if (document.visibilityState === "hidden") left = true;
    };
    document.addEventListener("visibilitychange", onHide);
    openExternal(smsHref(sms.recipients, sms.body));
    // If the page never lost visibility, the SMS app didn't open (no SIM, desktop …).
    setTimeout(() => {
      document.removeEventListener("visibilitychange", onHide);
      setSmsState(left ? "opened" : "failed");
    }, 2000);
  }, [sms]);

  useEffect(() => {
    if (launch?.openSms && (launch.id === id || (offline && launch.id === "offline"))) {
      setLaunch({ ...launch, openSms: false });
      openSms();
    }
  }, [launch, id, offline, openSms, setLaunch]);

  // --- keep the screen on --------------------------------------------------------------------
  useEffect(() => {
    let release = () => {};
    const acquire = async () => {
      release();
      release = await keepScreenOn();
    };
    acquire();
    const onVisible = () => document.visibilityState === "visible" && acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      release();
    };
  }, []);

  // --- location every 30 s while this screen is visible ---------------------------------------
  useEffect(() => {
    if (offline ? !pending : !sos || !OPEN.includes(sos.status)) return undefined;
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      let fix;
      try {
        fix = await getPosition({ timeout: 8000, maximumAge: 10_000 });
      } catch {
        return;
      }
      if (offline) {
        queued.current.push({ ...fix, at: new Date().toISOString() });
        return;
      }
      try {
        await sosApi.location(id, fix);
        // Back online: send anything queued while the network was down, oldest first.
        while (queued.current.length)
          await sosApi.location(id, queued.current[0]).then(() => queued.current.shift());
      } catch {
        queued.current.push({ ...fix, at: new Date().toISOString() });
      }
    };
    const timer = setInterval(tick, LOCATION_EVERY_MS);
    return () => clearInterval(timer);
  }, [offline, pending, sos, id]);

  // --- offline mode: retry POST /sos every 10 s for 2 minutes --------------------------------
  useEffect(() => {
    if (!offline || !pending) return undefined;
    const attempt = async () => {
      if (Date.now() - pending.startedAt > RETRY_FOR_MS) return;
      // Opened while the server was down: restore the session first (refresh cookie).
      if (!useSession.getState().accessToken) {
        try {
          await refreshSession();
        } catch {
          return;
        }
      }
      const result = await postSos(pending.payload);
      if (!result.ok) return;
      const created = result.sos;
      // Send whatever locations were gathered while offline.
      for (const p of queued.current.splice(0)) sosApi.location(created.id, p).catch(() => {});
      // `pending` is cleared once the real SOS is showing (effect below): clearing it here would
      // briefly leave /sos/offline with nothing to show, which redirects home.
      setLaunch({
        id: created.id,
        sms: pending.sms,
        openSms: false,
        permissionDenied: pending.permissionDenied,
      });
      navigate(`/sos/${created.id}`, { replace: true });
    };
    const timer = setInterval(attempt, RETRY_EVERY_MS);
    return () => clearInterval(timer);
  }, [offline, pending, navigate, setLaunch, setPending]);

  useEffect(() => {
    if (!offline && pending) setPending(null);
  }, [offline, pending, setPending]);

  // --- real-time updates from the authority -------------------------------------------------
  useSocketEvent("sos:acknowledged", (e) => {
    if (e?.id === id) qc.invalidateQueries({ queryKey: ["sos", id] });
  });
  useSocketEvent("sos:updated", (e) => {
    if (e?.id !== id) return;
    qc.invalidateQueries({ queryKey: ["sos", id] });
    if (e.status === "RESOLVED_BY_AUTHORITY") setClosedByAuthority(true);
  });

  // --- actions -----------------------------------------------------------------------------
  const resolve = async () => {
    setBusy(true);
    try {
      await sosApi.resolve(id);
      navigate(`/sos/${id}/done`, { replace: true });
    } catch {
      toast(t("states.networkError", { ns: "common" }), "error");
    } finally {
      setBusy(false);
      setConfirmSafe(false);
    }
  };

  const stillNeedHelp = async () => {
    setClosedByAuthority(false);
    const result = await postSos({
      source: "village",
      ...(sos?.lastLocation ? { ...sos.lastLocation, source: "last_known" } : {}),
    });
    if (result.ok) {
      setLaunch({
        id: result.sos.id,
        sms: { recipients: result.sos.smsRecipients, body: result.sos.smsBody },
        openSms: true,
      });
      navigate(`/sos/${result.sos.id}`, { replace: true });
    }
  };

  // Opening an old or unknown SOS: go home and say it has ended (docs/03 S-07 states).
  const loadFailed = !offline && query.isError;
  useEffect(() => {
    if (loadFailed) toast(t("active.ended"), "info");
  }, [loadFailed, t]);

  // --- render --------------------------------------------------------------------------------
  if (offline && !pending) return <Navigate to="/" replace />;
  if (loadFailed) return <Navigate to="/" replace />;
  if (!offline && !sos)
    return (
      <Box sx={{ p: 2 }}>
        <ListSkeleton />
      </Box>
    );
  if (!offline && !OPEN.includes(sos.status) && !closedByAuthority)
    return <Navigate to={`/sos/${id}/done`} replace />;

  const contacts = offline ? [] : sos.contacts;
  const recipients = sms?.recipients ?? [];
  const approximate = offline ? pending.payload.source !== "gps" : sos.approximate;
  const permissionDenied = offline
    ? pending.permissionDenied
    : launch?.id === id && launch.permissionDenied;
  const shareText = sms?.body ?? "";
  const startedAt = offline ? pending.startedAt : sos.triggeredAt;
  const location = offline
    ? pending.payload.lat !== undefined
      ? { lat: pending.payload.lat, lng: pending.payload.lng }
      : null
    : sos.lastLocation;

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <Box component="header" sx={{ bgcolor: "error.main", color: "#fff", px: 2, py: 2 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box
            aria-hidden
            className="pulse-dot"
            sx={{ width: 16, height: 16, borderRadius: "50%", bgcolor: "#fff" }}
          />
          <Typography variant="h1" component="h1" sx={{ fontSize: "1.5rem" }}>
            {t("active.title")}
          </Typography>
        </Stack>
        <Typography sx={{ mt: 0.5 }}>{t("active.started", { ago: timeAgo(startedAt) })}</Typography>
      </Box>

      <Stack component="main" id="main" spacing={2.5} sx={{ p: 2, maxWidth: 640, mx: "auto" }}>
        <Box component="section" aria-labelledby="checklist-title">
          <Typography id="checklist-title" variant="h3" component="h2" className="visually-hidden">
            {t("active.checklist")}
          </Typography>
          <Box component="ul" aria-live="polite" sx={{ listStyle: "none", p: 0, m: 0 }}>
            <Step ok={!approximate} warn={approximate}>
              {approximate ? t("active.locationApprox") : t("active.locationShared")}
              {permissionDenied && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  component="span"
                  sx={{ display: "block" }}
                >
                  {t("active.permissionOff")}
                </Typography>
              )}
            </Step>
            <Step ok={!offline}>
              {offline
                ? t("active.authorityPending")
                : sos.acknowledgedBy
                  ? t("active.acknowledgedBy", { name: sos.acknowledgedBy.name })
                  : t("active.authorityAlerted")}
            </Step>
            {recipients.length > 0 ? (
              <Step
                ok={smsState === "opened"}
                action={
                  <Button
                    size="small"
                    startIcon={<SmsRounded />}
                    onClick={openSms}
                    sx={{ mt: 0.5, ml: -1 }}
                  >
                    {t("active.openSms")}
                  </Button>
                }
              >
                {smsState === "opened" ? t("active.smsOpened") : t("active.smsStep")}
              </Step>
            ) : (
              <Step
                warn
                action={
                  <Link component={RouterLink} to="/profile/contacts" sx={{ fontWeight: 500 }}>
                    {t("active.addContacts")}
                  </Link>
                }
              >
                {t("active.noContacts")}
              </Step>
            )}
            {!offline && sos.emailTargets > 0 && (
              <Step ok={sos.emailedCount > 0}>
                {sos.emailedCount > 0
                  ? t("active.emailSent", { count: sos.emailedCount })
                  : t("active.emailSending")}
              </Step>
            )}
          </Box>
        </Box>

        {/* Browsers only open the SMS app from a tap: after the countdown auto-sends, or with no
            SIM, the automatic open is blocked. One tap here always works (it is a user gesture). */}
        {smsState === "failed" && recipients.length > 0 && (
          <Box
            role="alert"
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: "error.light",
              border: "2px solid",
              borderColor: "error.main",
            }}
          >
            <Typography sx={{ mb: 1.5 }}>{t("active.smsFailed")}</Typography>
            <Button
              variant="contained"
              color="error"
              fullWidth
              size="large"
              startIcon={<SmsRounded />}
              onClick={openSms}
              sx={{ minHeight: 64, fontSize: "1.2rem", fontWeight: 700 }}
            >
              {t("active.sendSmsNow")}
            </Button>
            <Typography variant="body2" sx={{ mt: 1.5 }}>
              {t("active.smsFailedStill")}
            </Typography>
          </Box>
        )}

        {location && (
          <Box>
            <MapView
              center={location}
              accuracyM={offline ? pending.payload.accuracyM : sos.lastAccuracyM}
              approximate={approximate}
              height={200}
            />
            {!offline && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {t("active.updated", { ago: timeAgo(sos.lastUpdateAt) })}
              </Typography>
            )}
          </Box>
        )}

        <Stack spacing={1.5}>
          <Button
            component="a"
            href="tel:112"
            variant="contained"
            color="error"
            size="large"
            startIcon={<CallRounded />}
            sx={{ minHeight: 64, fontSize: "1.2rem", fontWeight: 700 }}
          >
            {t("call112")}
          </Button>
          {contacts.slice(0, 2).map((c) => (
            <Button
              key={c.phone}
              component="a"
              href={`tel:${c.phone}`}
              variant="outlined"
              startIcon={<CallRounded />}
            >
              {t("active.callContact", { name: c.name })}
            </Button>
          ))}
          {contacts.length > 2 && (
            <>
              <Button
                variant="text"
                onClick={() => setShowMore((v) => !v)}
                aria-expanded={showMore}
              >
                {t("active.more")}
              </Button>
              <Collapse in={showMore}>
                <Stack spacing={1.5}>
                  {contacts.slice(2).map((c) => (
                    <Button
                      key={c.phone}
                      component="a"
                      href={`tel:${c.phone}`}
                      variant="outlined"
                      startIcon={<CallRounded />}
                    >
                      {t("active.callContact", { name: c.name })}
                    </Button>
                  ))}
                </Stack>
              </Collapse>
            </>
          )}
          {shareText && (
            <Button
              variant={smsState === "failed" ? "contained" : "outlined"}
              onClick={() => openExternal(whatsappHref(shareText))}
            >
              {t("active.whatsapp")}
            </Button>
          )}
          {shareText && smsState === "failed" && (
            <Button
              variant="outlined"
              startIcon={<ContentCopyRounded />}
              onClick={async () => (await copyText(shareText)) && toast(t("active.copied"))}
            >
              {t("active.copy")}
            </Button>
          )}
        </Stack>

        {!offline && (
          <Button
            variant="contained"
            color="success"
            size="large"
            startIcon={<VerifiedUserRounded />}
            onClick={() => setConfirmSafe(true)}
            sx={{ mt: 4, minHeight: 64, fontSize: "1.2rem" }}
          >
            {t("active.safe")}
          </Button>
        )}
      </Stack>

      <ResponsiveDialog
        open={confirmSafe}
        onClose={() => setConfirmSafe(false)}
        title={t("active.safeConfirmTitle")}
        labelId="safe-confirm-title"
        actions={
          <>
            <Button variant="outlined" onClick={() => setConfirmSafe(false)} disabled={busy}>
              {t("active.safeNo")}
            </Button>
            <Button variant="contained" color="success" onClick={resolve} disabled={busy}>
              {t("active.safeYes")}
            </Button>
          </>
        }
      >
        {t("active.safeConfirmBody")}
      </ResponsiveDialog>

      <ResponsiveDialog
        open={closedByAuthority}
        title={t("active.closedByAuthorityTitle")}
        labelId="closed-title"
        actions={
          <>
            <Button variant="outlined" color="error" onClick={stillNeedHelp}>
              {t("active.stillNeedHelp")}
            </Button>
            <Button
              variant="contained"
              color="success"
              onClick={() => navigate(`/sos/${id}/done`, { replace: true })}
            >
              {t("active.safeYes")}
            </Button>
          </>
        }
      >
        {t("active.closedByAuthorityBody")}
      </ResponsiveDialog>
    </Box>
  );
}
