import { useEffect, useRef, useState } from "react";
import { Box, Button, ButtonBase, Stack, TextField, Typography } from "@mui/material";
import {
  CallEndRounded,
  CallRounded,
  DialpadRounded,
  MicOffRounded,
  VolumeUpRounded,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { vibrate } from "../../lib/device.js";
import { FilterChips } from "../../components/ui/FilterChips.jsx";
import { PageTitle } from "../../components/ui/PageTitle.jsx";

const PRESETS = ["mom", "papa", "bhaiya", "office"];
const DELAYS = [0, 10, 30];
const RING_TIMEOUT_MS = 45_000; // docs/03 S-09b

/**
 * Ringtone synthesised with Web Audio: no audio file to download, works offline, and needs no
 * licence. A classic two-tone ring, 2 s on / 2 s off.
 */
function startRingtone() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return () => {};
  const ctx = new Ctx();
  const gain = ctx.createGain();
  gain.gain.value = 0;
  gain.connect(ctx.destination);
  const oscs = [440, 480].map((f) => {
    const o = ctx.createOscillator();
    o.frequency.value = f;
    o.connect(gain);
    o.start();
    return o;
  });
  let on = true;
  const tick = () => {
    gain.gain.setTargetAtTime(on ? 0.25 : 0, ctx.currentTime, 0.02);
    on = !on;
  };
  tick();
  const id = setInterval(tick, 2000);
  return () => {
    clearInterval(id);
    oscs.forEach((o) => o.stop());
    ctx.close().catch(() => {});
  };
}

function RoundAction({ color, icon: Icon, label, onClick, active }) {
  return (
    <Stack alignItems="center" spacing={1}>
      <ButtonBase
        onClick={onClick}
        aria-label={label}
        aria-pressed={active}
        focusRipple
        sx={{
          width: 72,
          height: 72,
          borderRadius: "50%",
          bgcolor: color ?? (active ? "#fff" : "rgba(255,255,255,0.15)"),
          color: active && !color ? "#000" : "#fff",
        }}
      >
        <Icon sx={{ fontSize: 34 }} />
      </ButtonBase>
      <Typography variant="body2" sx={{ color: "#fff" }}>
        {label}
      </Typography>
    </Stack>
  );
}

/** Full-screen, phone-like overlay (S-09b ringing, S-09c in call). */
function CallScreen({ children }) {
  return (
    <Box
      role="dialog"
      aria-modal="true"
      sx={{
        position: "fixed",
        inset: 0,
        zIndex: 2000,
        bgcolor: "#111",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        py: 8,
        px: 3,
      }}
    >
      {children}
    </Box>
  );
}

/** S-09 Fake call (docs/03): setup → ringing → in call. No network or server needed. */
export default function FakeCallPage() {
  const { t } = useTranslation("sos");
  const navigate = useNavigate();
  const [name, setName] = useState(() => t("fake.presets.mom"));
  const [delay, setDelay] = useState(0);
  const [phase, setPhase] = useState("setup"); // setup | waiting | ringing | call
  const [left, setLeft] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [toggles, setToggles] = useState({ mute: false, speaker: false, keypad: false });
  const stopRing = useRef(() => {});
  const swipeStart = useRef(null);

  const exitFullscreen = () =>
    document.fullscreenElement && document.exitFullscreen?.().catch(() => {});

  // Waiting → ringing
  useEffect(() => {
    if (phase !== "waiting") return undefined;
    if (left <= 0) {
      setPhase("ringing");
      return undefined;
    }
    const id = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(id);
  }, [phase, left]);

  // Ringing: sound + vibration; give up after 45 s
  useEffect(() => {
    if (phase !== "ringing") return undefined;
    stopRing.current = startRingtone();
    vibrate([800, 400, 800, 2000]);
    const buzz = setInterval(() => vibrate([800, 400, 800, 2000]), 4000);
    const timeout = setTimeout(() => setPhase("setup"), RING_TIMEOUT_MS);
    return () => {
      stopRing.current();
      clearInterval(buzz);
      clearTimeout(timeout);
      vibrate(0);
    };
  }, [phase]);

  // In call: timer + a short voice line (speech synthesis, Hindi if the phone has it)
  useEffect(() => {
    if (phase !== "call") return undefined;
    setSeconds(0);
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    const speak = setTimeout(() => {
      try {
        const u = new SpeechSynthesisUtterance(t("fake.voice"));
        u.lang = "hi-IN";
        window.speechSynthesis?.speak(u);
      } catch {
        // no speech synthesis on this device
      }
    }, 1500);
    return () => {
      clearInterval(id);
      clearTimeout(speak);
      window.speechSynthesis?.cancel?.();
    };
  }, [phase, t]);

  const start = () => {
    document.documentElement.requestFullscreen?.().catch(() => {});
    setLeft(delay);
    setPhase(delay ? "waiting" : "ringing");
  };
  const decline = () => {
    exitFullscreen();
    setPhase("setup");
  };
  const end = () => {
    exitFullscreen();
    navigate("/");
  };

  if (phase === "ringing") {
    const initial = Array.from(name.trim())[0] ?? "?";
    return (
      <CallScreen>
        <Stack alignItems="center" spacing={1.5}>
          <Typography variant="body2" sx={{ opacity: 0.8 }}>
            {t("fake.incoming")}
          </Typography>
          <Box
            sx={{
              width: 112,
              height: 112,
              borderRadius: "50%",
              bgcolor: "#3A4A5C",
              display: "grid",
              placeItems: "center",
              fontSize: 48,
              fontWeight: 500,
            }}
          >
            {initial}
          </Box>
          <Typography sx={{ fontSize: "2rem", fontWeight: 500 }}>{name}</Typography>
          <Typography sx={{ opacity: 0.8 }}>{t("fake.mobile")}</Typography>
        </Stack>
        <Stack spacing={2} alignItems="center" sx={{ width: "100%" }}>
          <Typography variant="body2" sx={{ opacity: 0.7 }}>
            {t("fake.swipe")}
          </Typography>
          <Stack
            direction="row"
            justifyContent="space-around"
            sx={{ width: "100%", maxWidth: 360, touchAction: "none" }}
            onPointerDown={(e) => (swipeStart.current = e.clientY)}
            onPointerUp={(e) => {
              if (swipeStart.current !== null && swipeStart.current - e.clientY > 80)
                setPhase("call");
              swipeStart.current = null;
            }}
          >
            <RoundAction
              color="#D32F2F"
              icon={CallEndRounded}
              label={t("fake.decline")}
              onClick={decline}
            />
            <RoundAction
              color="#2E7D32"
              icon={CallRounded}
              label={t("fake.answer")}
              onClick={() => setPhase("call")}
            />
          </Stack>
        </Stack>
      </CallScreen>
    );
  }

  if (phase === "call") {
    const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
    const ss = String(seconds % 60).padStart(2, "0");
    const toggle = (k) => setToggles((s) => ({ ...s, [k]: !s[k] }));
    return (
      <CallScreen>
        <Stack alignItems="center" spacing={1}>
          <Typography sx={{ fontSize: "2rem", fontWeight: 500 }}>{name}</Typography>
          <Typography role="timer" sx={{ opacity: 0.8, fontVariantNumeric: "tabular-nums" }}>
            {mm}:{ss}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={4}>
          <RoundAction
            icon={MicOffRounded}
            label={t("fake.mute")}
            active={toggles.mute}
            onClick={() => toggle("mute")}
          />
          <RoundAction
            icon={VolumeUpRounded}
            label={t("fake.speaker")}
            active={toggles.speaker}
            onClick={() => toggle("speaker")}
          />
          <RoundAction
            icon={DialpadRounded}
            label={t("fake.keypad")}
            active={toggles.keypad}
            onClick={() => toggle("keypad")}
          />
        </Stack>
        <RoundAction color="#D32F2F" icon={CallEndRounded} label={t("fake.end")} onClick={end} />
      </CallScreen>
    );
  }

  return (
    <Stack spacing={3} sx={{ maxWidth: 520 }}>
      <PageTitle subtitle={t("fake.intro")}>{t("fake.title")}</PageTitle>
      <TextField
        label={t("fake.caller")}
        value={name}
        onChange={(e) => setName(e.target.value)}
        inputProps={{ maxLength: 30 }}
        fullWidth
      />
      <FilterChips
        label={t("fake.caller")}
        value={PRESETS.find((p) => t(`fake.presets.${p}`) === name) ?? ""}
        onChange={(p) => setName(t(`fake.presets.${p}`))}
        options={PRESETS.map((p) => ({ value: p, label: t(`fake.presets.${p}`) }))}
      />
      <Box>
        <Typography id="when-label" sx={{ mb: 1, fontWeight: 500 }}>
          {t("fake.when")}
        </Typography>
        <FilterChips
          label={t("fake.when")}
          value={delay}
          onChange={setDelay}
          options={DELAYS.map((d) => ({
            value: d,
            label: d === 0 ? t("fake.now") : t(`fake.in${d}`),
          }))}
        />
      </Box>
      {phase === "waiting" ? (
        <Stack spacing={1.5}>
          <Typography role="status" aria-live="polite">
            {t("fake.waiting", { n: left })}
          </Typography>
          <Button variant="outlined" onClick={() => setPhase("setup")}>
            {t("actions.cancel", { ns: "common" })}
          </Button>
        </Stack>
      ) : (
        <Button
          variant="contained"
          size="large"
          startIcon={<CallRounded />}
          onClick={start}
          disabled={!name.trim()}
        >
          {t("fake.start")}
        </Button>
      )}
    </Stack>
  );
}
