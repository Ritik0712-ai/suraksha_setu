import { useState } from "react";
import { Box, Button, Container, Stack, Typography } from "@mui/material";
import { PhotoCameraRounded } from "@mui/icons-material";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { safeNext } from "../../lib/nextPath.js";
import { speak, stopSpeaking } from "../../lib/speech.js";
import { SahayakIcon } from "../../components/icons/index.jsx";
import { ListenButton } from "../../components/ui/Speech.jsx";
import { EmergencyBar, TricolourStrip } from "../../components/layout/CitizenShell.jsx";

function SosPicture() {
  return (
    <Box
      aria-hidden
      sx={{
        width: 150,
        height: 150,
        borderRadius: "50%",
        bgcolor: "error.main",
        color: "#fff",
        display: "grid",
        placeItems: "center",
        fontSize: "2.5rem",
        fontWeight: 700,
        boxShadow: "0 0 0 12px rgba(200,30,30,0.15)",
      }}
    >
      SOS
    </Box>
  );
}

function IconPicture({ icon: Icon, bg, color }) {
  return (
    <Box
      aria-hidden
      sx={{
        width: 150,
        height: 150,
        borderRadius: 6,
        bgcolor: bg,
        display: "grid",
        placeItems: "center",
      }}
    >
      <Icon sx={{ fontSize: 88, color }} />
    </Box>
  );
}

const SLIDES = [
  { key: "sos", picture: <SosPicture /> },
  {
    key: "complaint",
    picture: <IconPicture icon={PhotoCameraRounded} bg="#E8EEF6" color="#003366" />,
  },
  { key: "sahayak", picture: <IconPicture icon={SahayakIcon} bg="#FFF1E6" color="#C2410C" /> },
];

/**
 * Three-picture tour after the first language choice (and from "How to use the app"): SOS,
 * complaints, Sahayak. Big pictures, one line of text, and every slide can be heard — each one is
 * read aloud as the user taps Next (a tap allows the browser to speak).
 */
export function Tour({ onDone }) {
  const { t, i18n } = useTranslation("home");
  const [step, setStep] = useState(0);
  const slide = SLIDES[step];
  const last = step === SLIDES.length - 1;
  const textOf = (i) => `${t(`tour.${SLIDES[i].key}.title`)}। ${t(`tour.${SLIDES[i].key}.body`)}`;

  const finish = () => {
    stopSpeaking();
    onDone();
  };
  const next = () => {
    if (last) return finish();
    setStep(step + 1);
    speak(textOf(step + 1), { id: "tour", lang: i18n.language });
  };

  return (
    <Stack
      spacing={3}
      alignItems="center"
      textAlign="center"
      component="section"
      aria-label={t("tour.label")}
    >
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ width: "100%" }}
      >
        <Typography color="text.secondary" aria-live="polite">
          {t("tour.step", { n: step + 1, total: SLIDES.length })}
        </Typography>
        {!last && (
          <Button onClick={finish} sx={{ minHeight: 48 }}>
            {t("tour.skip")}
          </Button>
        )}
      </Stack>
      {slide.picture}
      <Typography variant="h2" component="h1">
        {t(`tour.${slide.key}.title`)}
      </Typography>
      <Typography sx={{ fontSize: "1.125rem" }}>{t(`tour.${slide.key}.body`)}</Typography>
      <ListenButton variant="button" text={textOf(step)} sx={{ minHeight: 48 }} />
      <Stack direction="row" spacing={1} aria-hidden>
        {SLIDES.map((s, i) => (
          <Box
            key={s.key}
            sx={{
              width: i === step ? 24 : 10,
              height: 10,
              borderRadius: 5,
              bgcolor: i === step ? "primary.main" : "divider",
              transition: "width .2s",
            }}
          />
        ))}
      </Stack>
      <Button
        variant="contained"
        onClick={next}
        fullWidth
        sx={{ minHeight: 64, fontSize: "1.25rem" }}
      >
        {last ? t("tour.start") : t("tour.next")}
      </Button>
    </Stack>
  );
}

/** /tour — the same tour, reopened from the home screen. */
export default function TourPage() {
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <TricolourStrip />
      <EmergencyBar />
      <Container maxWidth="sm" component="main" sx={{ flex: 1, py: 4 }}>
        <Tour onDone={() => navigate(safeNext(location.state?.from), { replace: true })} />
      </Container>
    </Box>
  );
}
