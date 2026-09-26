import { Alert, Snackbar, useMediaQuery } from "@mui/material";
import { useToast } from "../../stores/toast.js";

/** One toast at a time, bottom, above the bottom nav, 4 s (docs/04 §6.6). */
export function Toaster({ aboveBottomNav = false }) {
  const toast = useToast((s) => s.toast);
  const hide = useToast((s) => s.hide);
  const desktop = useMediaQuery((theme) => theme.breakpoints.up("md"));
  return (
    <Snackbar
      key={toast?.id}
      open={Boolean(toast)}
      autoHideDuration={4000}
      onClose={(_e, reason) => reason !== "clickaway" && hide()}
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      sx={{ bottom: aboveBottomNav && !desktop ? "88px !important" : undefined }}
    >
      <Alert
        severity={toast?.severity ?? "success"}
        variant="filled"
        onClose={hide}
        sx={{
          bgcolor: "#1A1A1A",
          color: "#fff",
          "& .MuiAlert-icon": { color: "#fff" },
          minWidth: 280,
        }}
      >
        {toast?.message}
      </Alert>
    </Snackbar>
  );
}
