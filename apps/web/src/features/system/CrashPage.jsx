import { Box, Button, Container, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { EmergencyBar, TricolourStrip } from "../../components/layout/CitizenShell.jsx";

/** X-05 Crash (router error boundary). The emergency bar stays visible. */
export function CrashPage() {
  const { t } = useTranslation("system");
  return (
    <Box>
      <TricolourStrip />
      <EmergencyBar />
      <Container maxWidth="sm" sx={{ py: 6 }}>
        <Stack spacing={3}>
          <Typography variant="h1">{t("crash")}</Typography>
          <Stack direction="row" spacing={2}>
            <Button variant="contained" onClick={() => window.location.reload()}>
              {t("reload")}
            </Button>
            <Button variant="outlined" href="/">
              {t("actions.goHome", { ns: "common" })}
            </Button>
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}
