import { Box, Paper, Typography } from "@mui/material";

/** Narrow centred card for the auth screens. */
export function AuthCard({ title, children }) {
  return (
    <Box sx={{ maxWidth: 480, mx: "auto" }}>
      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2 }}>
        <Typography variant="h1" sx={{ mb: 3 }}>
          {title}
        </Typography>
        {children}
      </Paper>
    </Box>
  );
}
