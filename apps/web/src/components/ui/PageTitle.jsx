import { Box, Typography } from "@mui/material";

/** Page title (H1) with an optional subtitle. */
export function PageTitle({ children, subtitle, sx }) {
  return (
    <Box sx={{ mb: 3, ...sx }}>
      <Typography variant="h1">{children}</Typography>
      {subtitle && (
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          {subtitle}
        </Typography>
      )}
    </Box>
  );
}
