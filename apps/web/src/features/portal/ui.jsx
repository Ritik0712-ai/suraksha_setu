import { Box, Chip, Paper, Stack, Tooltip, Typography } from "@mui/material";
import { GroupsRounded } from "@mui/icons-material";
import { useTranslation } from "react-i18next";

/** KPI card (docs/04 §7.2): big number, label, optional hint; red when `alert`. */
export function KpiCard({ label, value, hint, alert = false, icon: Icon, onClick }) {
  return (
    <Paper
      variant="outlined"
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => onClick && (e.key === "Enter" || e.key === " ") && onClick()}
      sx={{
        p: 2,
        cursor: onClick ? "pointer" : "default",
        borderColor: alert ? "error.main" : "divider",
        bgcolor: alert ? "#FDECEC" : "background.paper",
        "&:focus-visible": { outline: "3px solid #C2410C", outlineOffset: 2 },
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
        <Typography color={alert ? "error.main" : "text.secondary"} sx={{ fontWeight: 500 }}>
          {label}
        </Typography>
        {Icon && <Icon color={alert ? "error" : "primary"} />}
      </Stack>
      <Typography
        sx={{ fontSize: "2rem", fontWeight: 700, color: alert ? "error.main" : "text.primary" }}
      >
        {value}
      </Typography>
      {hint && (
        <Typography variant="body2" color="text.secondary">
          {hint}
        </Typography>
      )}
    </Paper>
  );
}

/** White card with a heading, used for portal page sections. */
export function Section({ title, action, children, sx }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, ...sx }}>
      {(title || action) && (
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ mb: 1.5 }}
          spacing={1}
        >
          {title && (
            <Typography variant="h2" sx={{ fontSize: "1.25rem" }}>
              {title}
            </Typography>
          )}
          {action && <Box>{action}</Box>}
        </Stack>
      )}
      {children}
    </Paper>
  );
}

/** 👥 n — other citizens who said "me too" on this complaint (shown when n > 0). */
export function MeTooBadge({ count, long = false }) {
  const { t } = useTranslation("portal");
  if (!count) return null;
  const text = t("complaints.meToo", { count });
  return (
    <Tooltip title={text}>
      <Chip
        size="small"
        color="secondary"
        icon={<GroupsRounded />}
        label={long ? text : `+${count}`}
        aria-label={text}
        sx={{ ml: 1, verticalAlign: "middle" }}
      />
    </Tooltip>
  );
}
