import { useState } from "react";
import { Box, Button, Paper, Stack, Typography } from "@mui/material";
import { CloudUploadRounded } from "@mui/icons-material";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { discardQueued, flushOutbox, useOutbox } from "../../lib/outbox.js";
import { formatDateTime } from "../../lib/time.js";
import { useSession } from "../../stores/session.js";
import { toast } from "../../stores/toast.js";
import { ConfirmDialog } from "../../components/ui/ResponsiveDialog.jsx";
import { CategoryIcon } from "./categories.jsx";

/** "Waiting to send (n)" — complaints saved on this phone without internet (lib/outbox.js). */
export function WaitingComplaints() {
  const { t } = useTranslation("complaints");
  const qc = useQueryClient();
  const { items, sending } = useOutbox();
  const userId = useSession((s) => s.user?.id ?? null);
  const authed = useSession((s) => s.status === "authed");
  const [deleting, setDeleting] = useState(null);
  if (!items.length) return null;

  const sendNow = async () => {
    const sent = await flushOutbox(userId);
    if (sent.length) {
      toast(
        sent.length === 1
          ? t("outbox.sentOne", { no: sent[0].complaintNo })
          : t("outbox.sentMany", { count: sent.length }),
      );
      qc.invalidateQueries({ queryKey: ["complaints"] });
    } else if (useOutbox.getState().offline)
      toast(t("states.networkError", { ns: "common" }), "error");
  };

  return (
    <Paper
      variant="outlined"
      component="section"
      aria-labelledby="waiting-heading"
      sx={{ p: 2, mb: 2, borderColor: "warning.main", borderWidth: 2 }}
    >
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
        <CloudUploadRounded color="warning" />
        <Typography id="waiting-heading" variant="h2" sx={{ fontSize: "1.125rem", flex: 1 }}>
          {t("outbox.title", { count: items.length })}
        </Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        {t("outbox.hint")}
      </Typography>
      <Stack spacing={1} component="ul" sx={{ listStyle: "none", p: 0, m: 0 }}>
        {items.map((x) => (
          <Stack component="li" key={x.id} direction="row" spacing={1.5} alignItems="center">
            <CategoryIcon category={x.body.category} sx={{ color: "primary.main" }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 500 }}>{t(`categories.${x.body.category}`)}</Typography>
              <Typography variant="body2" color="text.secondary">
                {t("outbox.savedAt", { time: formatDateTime(x.savedAt) })}
              </Typography>
              {x.error && (
                <Typography variant="body2" color="error.main">
                  {t("outbox.failed", { reason: x.error })}
                </Typography>
              )}
            </Box>
            <Button color="error" onClick={() => setDeleting(x)} disabled={sending}>
              {t("outbox.discard")}
            </Button>
          </Stack>
        ))}
      </Stack>
      <Button
        variant="contained"
        fullWidth
        sx={{ mt: 1.5 }}
        onClick={sendNow}
        disabled={sending || !authed}
      >
        {sending ? t("outbox.sending") : t("outbox.sendNow")}
      </Button>
      <ConfirmDialog
        open={Boolean(deleting)}
        title={t("outbox.discardTitle")}
        body={t("outbox.discardBody")}
        confirmLabel={t("outbox.discard")}
        cancelLabel={t("actions.cancel", { ns: "common" })}
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          const x = deleting;
          setDeleting(null);
          await discardQueued(userId, x.id);
        }}
      />
    </Paper>
  );
}
