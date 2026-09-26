import { Box, IconButton, LinearProgress, Stack, Typography } from "@mui/material";
import { ArrowBackRounded } from "@mui/icons-material";
import { useTranslation } from "react-i18next";

/**
 * Wizard frame (docs/04 §5.5): back button, title, "Step X of Y" and a progress bar. The
 * primary action sticks to the bottom (thumb zone).
 */
export function WizardFrame({ title, step, total, onBack, children, footer }) {
  const { t } = useTranslation();
  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 1 }}>
        <IconButton onClick={onBack} aria-label={t("actions.back")} sx={{ width: 48, height: 48 }}>
          <ArrowBackRounded />
        </IconButton>
        <Typography variant="h3" component="h1" sx={{ flex: 1 }}>
          {title}
        </Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary" aria-live="polite">
        {t("wizard.step", { current: step, total })}
      </Typography>
      <LinearProgress
        variant="determinate"
        value={(step / total) * 100}
        aria-label={t("wizard.step", { current: step, total })}
        sx={{ height: 8, borderRadius: 4, my: 1.5, bgcolor: "primary.light" }}
      />
      <Box sx={{ flex: 1, py: 2 }}>{children}</Box>
      {footer && (
        <Box
          sx={{
            position: "sticky",
            bottom: 0,
            py: 2,
            bgcolor: "background.default",
            borderTop: "1px solid",
            borderColor: "divider",
          }}
        >
          {footer}
        </Box>
      )}
    </Box>
  );
}
