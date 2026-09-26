import { Box, Button, ButtonBase, Stack, Typography } from "@mui/material";
import {
  AssignmentRounded,
  CampaignRounded,
  NotificationsNoneRounded,
  VolunteerActivismRounded,
} from "@mui/icons-material";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { apiError } from "../../api/client.js";
import { notificationsApi } from "../../api/endpoints.js";
import { useLocalized } from "../../lib/localized.js";
import { timeAgo } from "../../lib/time.js";
import { EmergencyIcon } from "../../components/icons/index.jsx";
import { PageTitle } from "../../components/ui/PageTitle.jsx";
import { EmptyState, ErrorCard, ListSkeleton } from "../../components/ui/States.jsx";

const ICONS = {
  complaint_submitted: AssignmentRounded,
  complaint_status: AssignmentRounded,
  complaint_note: AssignmentRounded,
  complaint_reopened: AssignmentRounded,
  sos_acknowledged: EmergencyIcon,
  sos_closed: EmergencyIcon,
  scheme_updated: VolunteerActivismRounded,
};

/** Renders templateKey + params in the reader's language (docs/05 §5.16). */
function useNotificationText() {
  const { t } = useTranslation("notifications");
  const localized = useLocalized();
  return (n) => {
    const key = n.templateKey?.replace(/^notif\./, "");
    const p = { ...n.params };
    if (p.status) p.status = t(`status.${p.status}`, { ns: "common" });
    if (p.name && typeof p.name === "object") p.name = localized(p.name);
    return t(`notif.${key}`, { ...p, defaultValue: t("notif.system") });
  };
}

/** S-29 Notifications (docs/03). Tap → mark read + open. */
export default function NotificationsPage() {
  const { t } = useTranslation("notifications");
  const text = useNotificationText();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const q = useInfiniteQuery({
    queryKey: ["notifications", "list"],
    queryFn: ({ pageParam }) => notificationsApi.list({ page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) => last.nextPage ?? undefined,
  });
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  const unread = q.data?.pages[0]?.unread ?? 0;

  const refresh = () => qc.invalidateQueries({ queryKey: ["notifications"] });
  const open = async (n) => {
    if (!n.read) await notificationsApi.read({ ids: [n.id] }).catch(() => {});
    refresh();
    if (n.link) navigate(n.link);
  };
  const markAll = async () => {
    await notificationsApi.read({ all: true }).catch(() => {});
    refresh();
  };

  return (
    <Stack spacing={2} sx={{ maxWidth: 720 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
        <PageTitle sx={{ mb: 0 }}>{t("title")}</PageTitle>
        {unread > 0 && (
          <Button variant="outlined" onClick={markAll}>
            {t("markAll")}
          </Button>
        )}
      </Stack>
      {q.isLoading && <ListSkeleton />}
      {q.isError && <ErrorCard network={apiError(q.error).network} onRetry={() => q.refetch()} />}
      {q.isSuccess && items.length === 0 && (
        <EmptyState icon={NotificationsNoneRounded} title={t("empty")} />
      )}
      <Stack component="ul" spacing={1} sx={{ listStyle: "none", p: 0, m: 0 }}>
        {items.map((n) => {
          const Icon = ICONS[n.type] ?? CampaignRounded;
          return (
            <li key={n.id}>
              <ButtonBase
                onClick={() => open(n)}
                sx={{
                  width: "100%",
                  justifyContent: "flex-start",
                  textAlign: "left",
                  gap: 1.5,
                  p: 2,
                  borderRadius: 2,
                  border: "1px solid",
                  borderColor: "divider",
                  bgcolor: n.read ? "background.paper" : "primary.light",
                }}
              >
                <Icon color="primary" />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: n.read ? 400 : 700 }}>{text(n)}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {timeAgo(n.createdAt)}
                  </Typography>
                </Box>
                {!n.read && (
                  <Box
                    aria-label={t("unread")}
                    sx={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      bgcolor: "#C2410C",
                      flexShrink: 0,
                    }}
                  />
                )}
              </ButtonBase>
            </li>
          );
        })}
      </Stack>
      {q.hasNextPage && (
        <Button onClick={() => q.fetchNextPage()} disabled={q.isFetchingNextPage}>
          {t("loadMore")}
        </Button>
      )}
    </Stack>
  );
}
