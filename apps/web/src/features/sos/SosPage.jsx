import { useEffect, useRef, useState } from "react";
import { Box, Button, CircularProgress, IconButton, Link, Stack, Typography } from "@mui/material";
import { CallRounded, CloseRounded, ShareRounded } from "@mui/icons-material";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getPosition, mapsLink } from "../../lib/geo.js";
import { openExternal, vibrate, whatsappHref } from "../../lib/device.js";
import { isSignedIn, useSession } from "../../stores/session.js";
import { useSosStore } from "../../stores/sos.js";
import { toast } from "../../stores/toast.js";
import { SosButton } from "../../components/ui/SosButton.jsx";
import { CountdownRing } from "./CountdownRing.jsx";
import { chooseLocation, offlineSms, postSos, startGps } from "./sendSos.js";

const COUNTDOWN = 5;

/** Full-screen red layout shared by the SOS screens. */
export function SosScreen({ children, onClose, closeLabel }) {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "error.main",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Box sx={{ display: "flex", justifyContent: "flex-start", p: 1, minHeight: 64 }}>
        {onClose && (
          <IconButton
            onClick={onClose}
            aria-label={closeLabel}
            sx={{ color: "#fff", width: 56, height: 56 }}
          >
            <CloseRounded fontSize="large" />
          </IconButton>
        )}
      </Box>
      <Stack
        component="main"
        id="main"
        alignItems="center"
        spacing={3}
        sx={{ flex: 1, px: 2, pb: 4, textAlign: "center" }}
      >
        {children}
      </Stack>
    </Box>
  );
}

const whiteButton = {
  bgcolor: "#fff",
  color: "error.main",
  "&:hover": { bgcolor: "#FDECEC" },
  fontWeight: 700,
};
const outlineWhite = {
  color: "#fff",
  borderColor: "#fff",
  borderWidth: 2,
  "&:hover": { borderWidth: 2, borderColor: "#fff", bgcolor: "rgba(255,255,255,0.1)" },
};

/** S-06-guest: no account — call 112 and share the location by hand (docs/03 S-06). */
function GuestSos() {
  const { t } = useTranslation("sos");
  const navigate = useNavigate();
  const [loc, setLoc] = useState({ state: "loading" });
  useEffect(() => {
    getPosition()
      .then((p) => setLoc({ state: "ok", ...p }))
      .catch(() => setLoc({ state: "error" }));
  }, []);
  const shareText = loc.state === "ok" ? t("guest.shareText", { link: mapsLink(loc) }) : "";
  const share = async () => {
    try {
      if (navigator.share) return await navigator.share({ text: shareText });
    } catch {
      return undefined; // user closed the share sheet
    }
    return openExternal(whatsappHref(shareText));
  };
  return (
    <SosScreen onClose={() => navigate(-1)} closeLabel={t("idle.close")}>
      <Typography variant="h1" component="h1">
        {t("guest.title")}
      </Typography>
      <Button
        component="a"
        href="tel:112"
        size="large"
        startIcon={<CallRounded />}
        sx={{ ...whiteButton, width: "100%", maxWidth: 420, minHeight: 72, fontSize: "1.333rem" }}
      >
        {t("call112")}
      </Button>
      <Box aria-live="polite" sx={{ maxWidth: 420 }}>
        {loc.state === "loading" && <Typography>{t("guest.locating")}</Typography>}
        {loc.state === "ok" && (
          <Typography>
            {t("guest.location", {
              coords: `${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}`,
              accuracy: loc.accuracyM,
            })}
          </Typography>
        )}
        {loc.state === "error" && <Typography>{t("guest.noLocation")}</Typography>}
      </Box>
      {loc.state === "ok" && (
        <Button
          variant="outlined"
          startIcon={<ShareRounded />}
          onClick={share}
          sx={{ ...outlineWhite, width: "100%", maxWidth: 420 }}
        >
          {t("guest.share")}
        </Button>
      )}
      <Typography sx={{ maxWidth: 420 }}>{t("guest.loginHint")}</Typography>
      <Button
        component={RouterLink}
        to="/login?next=%2Fsos"
        variant="outlined"
        sx={{ ...outlineWhite, width: "100%", maxWidth: 420 }}
      >
        {t("actions.logIn", { ns: "common" })}
      </Button>
    </SosScreen>
  );
}

/** S-06 SOS trigger + 5-second countdown (docs/03 S-06, docs/01 FR-SOS-01…04). */
export default function SosPage() {
  const { t } = useTranslation("sos");
  const navigate = useNavigate();
  const status = useSession((s) => s.status);
  const user = useSession((s) => s.user);
  const setLaunch = useSosStore((s) => s.setLaunch);
  const setPending = useSosStore((s) => s.setPending);
  const [phase, setPhase] = useState("idle"); // idle | countdown | sending
  const [n, setN] = useState(COUNTDOWN);
  const timer = useRef(null);
  const gps = useRef(null);
  const sent = useRef(false);

  useEffect(() => () => clearInterval(timer.current), []);

  if (status === "loading")
    return (
      <SosScreen>
        <CircularProgress sx={{ color: "#fff" }} />
      </SosScreen>
    );
  if (!isSignedIn(status)) return <GuestSos />;

  async function send() {
    if (sent.current) return;
    sent.current = true;
    clearInterval(timer.current);
    setPhase("sending");
    const { payload, denied } = await chooseLocation(gps.current);
    const result = await postSos(payload);
    if (result.ok) {
      const s = result.sos;
      setLaunch({
        id: s.id,
        sms: { recipients: s.smsRecipients, body: s.smsBody },
        openSms: !s.existing && s.smsRecipients.length > 0,
        permissionDenied: denied,
      });
      navigate(`/sos/${s.id}`, { replace: true });
      return;
    }
    if (result.network) {
      // Server unreachable: SMS from the phone with the contacts cached on this device, then
      // keep retrying the server from S-07 in offline mode.
      const sms = offlineSms(t, user?.name ?? "", payload);
      setPending({
        payload: { ...payload, triggeredAt: new Date().toISOString(), createdVia: "offline_retry" },
        sms,
        startedAt: Date.now(),
        permissionDenied: denied,
      });
      setLaunch({
        id: "offline",
        sms,
        openSms: sms.recipients.length > 0,
        permissionDenied: denied,
      });
      navigate("/sos/offline", { replace: true });
      return;
    }
    // Anything else (e.g. validation): don't leave them stuck — call 112 is right here.
    sent.current = false;
    setPhase("idle");
    toast(result.error?.message ?? t("states.serverError", { ns: "common" }), "error");
  }

  function start() {
    sent.current = false;
    setPhase("countdown");
    setN(COUNTDOWN);
    gps.current = startGps();
    gps.current.catch(() => {}); // handled in chooseLocation
    vibrate(200);
    let left = COUNTDOWN;
    timer.current = setInterval(() => {
      left -= 1;
      setN(left);
      if (left <= 0) send();
      else vibrate(200);
    }, 1000);
  }

  function cancel() {
    clearInterval(timer.current);
    setPhase("idle");
    setN(COUNTDOWN);
    toast(t("cancelled"), "info");
  }

  if (phase === "countdown")
    return (
      <SosScreen>
        <Typography variant="h1" component="h1" sx={{ mt: 2 }}>
          {t("countdown.sending")}
        </Typography>
        <CountdownRing n={n} total={COUNTDOWN} label={t("countdown.inSeconds", { n })} />
        <Stack spacing={2} sx={{ width: "100%", maxWidth: 420 }}>
          <Button
            onClick={cancel}
            autoFocus
            sx={{ ...whiteButton, minHeight: 72, fontSize: "1.333rem" }}
          >
            {t("countdown.cancel")}
          </Button>
          <Button variant="outlined" onClick={send} sx={outlineWhite}>
            {t("countdown.sendNow")}
          </Button>
        </Stack>
      </SosScreen>
    );

  if (phase === "sending")
    return (
      <SosScreen>
        <CircularProgress sx={{ color: "#fff", mt: 8 }} size={64} />
        <Typography variant="h2" component="h1" role="status">
          {t("sendingNow")}
        </Typography>
      </SosScreen>
    );

  return (
    <SosScreen onClose={() => navigate(-1)} closeLabel={t("idle.close")}>
      <SosButton size={220} onClick={start} aria-describedby="sos-caption" sx={{ mt: 2 }} />
      <Typography id="sos-caption" sx={{ maxWidth: 360, fontSize: "1.111rem" }}>
        {t("idle.caption")}
      </Typography>
      <Button
        component="a"
        href="tel:112"
        variant="outlined"
        startIcon={<CallRounded />}
        sx={{ ...outlineWhite, width: "100%", maxWidth: 420 }}
      >
        {t("call112")}
      </Button>
      <Link component={RouterLink} to="/fake-call" sx={{ color: "#fff", py: 1 }}>
        {t("modules.fakeCall", { ns: "common" })}
      </Link>
    </SosScreen>
  );
}
