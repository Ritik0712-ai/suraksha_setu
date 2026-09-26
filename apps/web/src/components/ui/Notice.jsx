import { Box, Typography } from "@mui/material";
import {
  CheckCircleRounded,
  ErrorRounded,
  InfoRounded,
  WarningAmberRounded,
} from "@mui/icons-material";

// Inline notices (docs/04 §6.6) and highlight cards (§6.2).
const KINDS = {
  info: { bg: "#E8EEF6", fg: "#003366", Icon: InfoRounded },
  warning: { bg: "#FFF8E1", fg: "#B45309", Icon: WarningAmberRounded },
  error: { bg: "#FDECEC", fg: "#C62828", Icon: ErrorRounded },
  success: { bg: "#E6F4E6", fg: "#0B6E0B", Icon: CheckCircleRounded },
};

export function Notice({ kind = "info", title, children, action, role }) {
  const k = KINDS[kind];
  return (
    <Box
      role={role ?? (kind === "error" ? "alert" : "status")}
      sx={{
        display: "flex",
        gap: 1.5,
        p: 2,
        borderRadius: 2,
        bgcolor: k.bg,
        alignItems: "flex-start",
      }}
    >
      <k.Icon sx={{ color: k.fg, mt: 0.25 }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {title && (
          <Typography
            variant="body1"
            sx={{ fontWeight: 700, color: kind === "info" ? k.fg : "text.primary" }}
          >
            {title}
          </Typography>
        )}
        {children && <Typography variant="body2">{children}</Typography>}
        {action && <Box sx={{ mt: 1.5 }}>{action}</Box>}
      </Box>
    </Box>
  );
}

/** Saffron highlight card: 4 px left border + saffron-50 background (docs/04 §6.2). */
export function HighlightCard({ children, sx }) {
  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 2,
        bgcolor: "secondary.light",
        borderLeft: "4px solid #FF6600",
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}
