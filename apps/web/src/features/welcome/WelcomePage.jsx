import { lazy, Suspense, useState } from "react";
import { Box, Button, Container, Stack, Typography } from "@mui/material";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { safeNext } from "../../lib/nextPath.js";
import { usePrefs } from "../../stores/prefs.js";
import { LogoMark } from "../../components/icons/index.jsx";
import { EmergencyBar, TricolourStrip } from "../../components/layout/CitizenShell.jsx";
// Only first-time visitors see the tour, so it loads separately.
const Tour = lazy(() => import("./Tour.jsx").then((m) => ({ default: m.Tour })));

/**
 * S-01 Language select — first launch only. Static, works offline (docs/03 S-01). Then a
 * three-picture tour (SOS, complaints, Sahayak) that can be skipped.
 */
export default function WelcomePage() {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const setLanguage = usePrefs((s) => s.setLanguage);
  const [touring, setTouring] = useState(false);
  const done = () => navigate(safeNext(location.state?.from), { replace: true });

  const choose = (lng) => {
    i18n.changeLanguage(lng);
    setLanguage(lng);
    setTouring(true);
  };

  if (touring)
    return (
      <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <TricolourStrip />
        <EmergencyBar />
        <Container maxWidth="sm" component="main" sx={{ flex: 1, py: 4 }}>
          <Suspense fallback={null}>
            <Tour onDone={done} />
          </Suspense>
        </Container>
      </Box>
    );

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <TricolourStrip />
      <EmergencyBar />
      <Container maxWidth="sm" component="main" sx={{ flex: 1, py: 6 }}>
        <Stack spacing={4} alignItems="center" textAlign="center">
          <LogoMark size={88} />
          <Box>
            <Typography variant="h1" component="p" lang="hi" color="primary">
              सुरक्षा सेतु
            </Typography>
            <Typography variant="h3" component="p" lang="en" color="primary">
              Suraksha Setu
            </Typography>
          </Box>
          <Typography variant="h2" component="h1">
            <span lang="hi">अपनी भाषा चुनें</span> / <span lang="en">Choose your language</span>
          </Typography>
          <Stack spacing={2} sx={{ width: "100%" }}>
            <Button
              variant="contained"
              lang="hi"
              onClick={() => choose("hi")}
              sx={{ minHeight: 72, fontSize: "1.333rem" }}
            >
              हिन्दी
            </Button>
            <Button
              variant="outlined"
              lang="en"
              onClick={() => choose("en")}
              sx={{
                minHeight: 72,
                fontSize: "1.333rem",
                borderWidth: 2,
                "&:hover": { borderWidth: 2 },
              }}
            >
              English
            </Button>
          </Stack>
          <Typography color="text.secondary">
            <span lang="hi">देखने के लिए खाते की ज़रूरत नहीं।</span>
            <br />
            <span lang="en">No account needed to look around.</span>
          </Typography>
        </Stack>
      </Container>
    </Box>
  );
}
