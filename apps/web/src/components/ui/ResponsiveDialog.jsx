import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  useMediaQuery,
} from "@mui/material";

/**
 * Bottom sheet on mobile, centred dialog (max 560 px) on desktop (docs/04 §6.5). On mobile the
 * actions stack full width with the primary action at the bottom.
 */
export function ResponsiveDialog({
  open,
  onClose,
  title,
  children,
  actions,
  labelId = "dialog-title",
}) {
  const desktop = useMediaQuery((theme) => theme.breakpoints.up("md"));
  if (desktop) {
    return (
      <Dialog open={open} onClose={onClose} aria-labelledby={labelId} fullWidth maxWidth="sm">
        <DialogTitle id={labelId} variant="h3" component="h2">
          {title}
        </DialogTitle>
        <DialogContent>{children}</DialogContent>
        {actions && <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>{actions}</DialogActions>}
      </Dialog>
    );
  }
  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      PaperProps={{
        role: "dialog",
        "aria-modal": true,
        "aria-labelledby": labelId,
        sx: { borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: "92vh" },
      }}
    >
      <Box
        sx={{ width: 40, height: 4, bgcolor: "divider", borderRadius: 2, mx: "auto", mt: 1.5 }}
      />
      <Box sx={{ p: 2, pb: "calc(16px + env(safe-area-inset-bottom))", overflowY: "auto" }}>
        <Box id={labelId} component="h2" sx={{ typography: "h3", m: 0, mb: 2 }}>
          {title}
        </Box>
        {children}
        {actions && (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column-reverse",
              gap: 1,
              mt: 3,
              "& > *": { width: "100%" },
            }}
          >
            {actions}
          </Box>
        )}
      </Box>
    </Drawer>
  );
}

/**
 * Confirmation for destructive actions (docs/03 §0.4): Cancel (secondary) plus the destructive
 * action as a red *text* button — never a big red filled button that could look like SOS
 * (docs/04 §3.2).
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  busy = false,
  confirmDisabled = false,
  children,
}) {
  return (
    <ResponsiveDialog
      open={open}
      onClose={busy ? undefined : onCancel}
      title={title}
      labelId="confirm-title"
      actions={
        <>
          <Button variant="outlined" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            color="error"
            variant="text"
            onClick={onConfirm}
            disabled={busy || confirmDisabled}
            sx={{ fontWeight: 700 }}
          >
            {busy ? <CircularProgress size={22} color="inherit" /> : confirmLabel}
          </Button>
        </>
      }
    >
      {body && <Box sx={{ typography: "body1", mb: children ? 2 : 0 }}>{body}</Box>}
      {children}
    </ResponsiveDialog>
  );
}
