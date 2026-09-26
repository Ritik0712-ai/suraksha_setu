import { Box, Button, Container, Link, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

// Phase 0 placeholder. The real citizen shell (header, bottom nav, routes) is task 3.3.
export default function App() {
  const { t, i18n } = useTranslation();
  const next = i18n.resolvedLanguage === "hi" ? "en" : "hi";

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Box
        aria-hidden
        sx={{
          height: 4,
          background: "linear-gradient(90deg,#FF6600 33%,#fff 33% 66%,#138808 66%)",
        }}
      />
      <Box
        component="header"
        sx={{ display: "flex", alignItems: "center", gap: 1, px: 2, minHeight: 56 }}
      >
        <img src="/logo.svg" alt="" width={32} height={32} />
        <Typography component="span" variant="h3" color="primary" sx={{ flex: 1 }}>
          {t("appName")}
        </Typography>
        <Button
          size="small"
          aria-label={t("languageToggleLabel")}
          onClick={() => i18n.changeLanguage(next)}
        >
          EN | हि
        </Button>
      </Box>
      <Link
        href="tel:112"
        underline="none"
        sx={{ bgcolor: "error.main", color: "#fff", px: 2, py: 1.25, fontWeight: 500 }}
      >
        📞 {t("emergencyBar")}
      </Link>
      <Container component="main" sx={{ flex: 1, py: 4 }}>
        <Typography variant="h1" gutterBottom>
          नमस्ते 🙏
        </Typography>
        <Typography>{t("tagline")}</Typography>
        <Typography color="text.secondary" sx={{ mt: 2 }}>
          {t("setupNotice")}
        </Typography>
      </Container>
      <Box component="footer" sx={{ bgcolor: "primary.dark", color: "#fff", px: 2, py: 3 }}>
        <Typography variant="body2">{t("footer.disclaimer")}</Typography>
      </Box>
    </Box>
  );
}
