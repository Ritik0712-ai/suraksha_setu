import { Button, List, ListItem, ListItemText, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { sosApi } from "../../api/endpoints.js";
import { sosChipStatus } from "../../lib/sosStatus.js";
import { formatDateTime } from "../../lib/time.js";
import { ResponsiveDialog } from "../../components/ui/ResponsiveDialog.jsx";
import { ListSkeleton } from "../../components/ui/States.jsx";
import { StatusChip } from "../../components/ui/StatusChip.jsx";

/** "My SOS history" from S-27: date, duration, status. */
export function SosHistoryDialog({ open, onClose }) {
  const { t } = useTranslation("sos");
  const q = useQuery({ queryKey: ["sos", "mine"], queryFn: () => sosApi.mine(), enabled: open });
  return (
    <ResponsiveDialog
      open={open}
      onClose={onClose}
      title={t("history.title")}
      labelId="sos-history-title"
      actions={
        <Button variant="outlined" onClick={onClose}>
          {t("actions.close", { ns: "common" })}
        </Button>
      }
    >
      {q.isLoading && <ListSkeleton rows={2} />}
      {q.data?.length === 0 && <Typography>{t("history.empty")}</Typography>}
      {q.data?.length > 0 && (
        <List disablePadding>
          {q.data.map((s) => (
            <ListItem key={s.id} disableGutters divider sx={{ gap: 1, flexWrap: "wrap" }}>
              <ListItemText
                primary={formatDateTime(s.triggeredAt)}
                secondary={
                  s.durationSec
                    ? t("history.duration", {
                        minutes: Math.max(1, Math.round(s.durationSec / 60)),
                      })
                    : null
                }
              />
              <StatusChip status={sosChipStatus(s.status)} size="small" />
            </ListItem>
          ))}
        </List>
      )}
    </ResponsiveDialog>
  );
}
