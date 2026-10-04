import { useEffect, useId, useRef, useState } from "react";
import { Box, Button, IconButton, Tooltip } from "@mui/material";
import { MicRounded, StopRounded, VolumeUpRounded } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import {
  canListen,
  canSpeak,
  recognitionClass,
  speak,
  speechLocale,
  stopSpeaking,
  useSpeaking,
} from "../../lib/speech.js";
import { toast } from "../../stores/toast.js";

/**
 * 🔊 Reads `text` aloud in the current language; tap again to stop. Renders nothing when the
 * browser has no speech engine. `variant="button"` shows a labelled button, else an icon.
 */
export function ListenButton({ text, variant = "icon", size = "medium", label, sx }) {
  const { t, i18n } = useTranslation("common");
  const id = useId();
  const active = useSpeaking((s) => s.id === id);

  // Stop when the screen goes away.
  useEffect(
    () => () => {
      if (useSpeaking.getState().id === id) stopSpeaking();
    },
    [id],
  );

  if (!canSpeak() || !text) return null;
  const toggle = () => (active ? stopSpeaking() : speak(text, { id, lang: i18n.language }));
  const name = active ? t("speech.stop") : (label ?? t("speech.listen"));
  const icon = active ? <StopRounded /> : <VolumeUpRounded />;

  if (variant === "button")
    return (
      <Button
        variant={active ? "contained" : "outlined"}
        size={size}
        startIcon={icon}
        onClick={toggle}
        aria-pressed={active}
        sx={sx}
      >
        {name}
      </Button>
    );
  return (
    <Tooltip title={name}>
      <IconButton
        aria-label={name}
        aria-pressed={active}
        onClick={toggle}
        size={size}
        color="primary"
        sx={{ ...(active && { bgcolor: "primary.main", color: "#fff" }), ...sx }}
      >
        {icon}
      </IconButton>
    </Tooltip>
  );
}

/**
 * 🎤 Voice typing: listens once and passes what was said to `onText(text)`. Renders nothing
 * when the browser can't do speech recognition (then the keyboard's own mic still works).
 */
export function MicButton({ onText, disabled, size = 56 }) {
  const { t, i18n } = useTranslation("common");
  const [listening, setListening] = useState(false);
  const rec = useRef(null);

  useEffect(() => () => rec.current?.abort?.(), []);

  if (!canListen()) return null;

  const start = () => {
    if (listening) {
      rec.current?.stop();
      return;
    }
    stopSpeaking();
    const Rec = recognitionClass();
    const r = new Rec();
    r.lang = speechLocale(i18n.language);
    r.interimResults = false;
    r.continuous = false;
    r.maxAlternatives = 1;
    r.onresult = (e) => {
      const said = Array.from(e.results)
        .map((res) => res[0]?.transcript ?? "")
        .join(" ")
        .trim();
      if (said) onText(said);
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed")
        toast(t("speech.micDenied"), "error");
      else if (e.error === "network") toast(t("speech.micOffline"), "error");
      else if (e.error === "no-speech") toast(t("speech.noSpeech"), "info");
    };
    r.onend = () => setListening(false);
    rec.current = r;
    try {
      r.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  };

  const name = listening ? t("speech.stopListening") : t("speech.speak");
  return (
    <Tooltip title={name}>
      <Box component="span">
        <IconButton
          aria-label={name}
          aria-pressed={listening}
          onClick={start}
          disabled={disabled}
          sx={{
            width: size,
            height: size,
            border: 2,
            borderColor: listening ? "error.main" : "primary.main",
            color: listening ? "#fff" : "primary.main",
            bgcolor: listening ? "error.main" : "background.paper",
            "&:hover": { bgcolor: listening ? "error.dark" : "action.hover" },
            ...(listening && {
              animation: "ss-pulse 1.2s ease-in-out infinite",
              "@keyframes ss-pulse": {
                "0%, 100%": { boxShadow: "0 0 0 0 rgba(200,30,30,.5)" },
                "50%": { boxShadow: "0 0 0 8px rgba(200,30,30,0)" },
              },
            }),
          }}
        >
          {listening ? <StopRounded /> : <MicRounded />}
        </IconButton>
      </Box>
    </Tooltip>
  );
}
