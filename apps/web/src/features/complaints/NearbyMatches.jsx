import { Button, Paper, Stack, Typography } from "@mui/material";
import { GroupsRounded, ThumbUpAltRounded } from "@mui/icons-material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiError } from "../../api/client.js";
import { complaintsApi } from "../../api/endpoints.js";
import { formatDate } from "../../lib/time.js";
import { toast } from "../../stores/toast.js";
import { StatusChip } from "../../components/ui/StatusChip.jsx";
import { CategoryIcon } from "./categories.jsx";

/**
 * "Already reported near you" (review step): open complaints of the same kind within 500 m.
 * "Me too" adds this citizen to it, so officials see how many people share the problem and
 * nobody has to file a duplicate. `onDone` leaves the wizard without filing.
 */
export function NearbyMatches({ category, location, onDone }) {
  const { t } = useTranslation("complaints");
  const qc = useQueryClient();
  const key = ["complaints-nearby", category, location?.lat, location?.lng];
  const q = useQuery({
    queryKey: key,
    queryFn: () =>
      complaintsApi.nearby({
        category,
        ...(location ? { lat: location.lat, lng: location.lng } : {}),
      }),
    enabled: Boolean(category),
    staleTime: 60_000,
    retry: false,
  });
  const toggle = useMutation({
    mutationFn: (c) =>
      c.supportedByMe ? complaintsApi.unsupport(c.id) : complaintsApi.support(c.id),
    onSuccess: (r) => {
      qc.setQueryData(key, (old) =>
        old?.map((x) =>
          x.id === r.id
            ? { ...x, supporterCount: r.supporterCount, supportedByMe: r.supportedByMe }
            : x,
        ),
      );
      if (r.supportedByMe) toast(t("nearby.added"));
    },
    onError: (err) => toast(apiError(err).message, "error"),
  });

  const list = q.data ?? [];
  if (!list.length) return null;
  const anySupported = list.some((x) => x.supportedByMe);

  return (
    <Paper
      variant="outlined"
      component="section"
      aria-labelledby="nearby-heading"
      sx={{ p: 2, borderColor: "secondary.main", borderWidth: 2, bgcolor: "#FFF8F1" }}
    >
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
        <GroupsRounded color="secondary" />
        <Typography id="nearby-heading" variant="h3" component="h3" sx={{ fontSize: "1.125rem" }}>
          {t("nearby.title")}
        </Typography>
      </Stack>
      <Typography variant="body2" sx={{ mb: 1.5 }}>
        {t("nearby.hint")}
      </Typography>
      <Stack spacing={1.5} component="ul" sx={{ listStyle: "none", p: 0, m: 0 }}>
        {list.map((c) => (
          <Paper key={c.id} component="li" variant="outlined" sx={{ p: 1.5, bgcolor: "#fff" }}>
            <Stack direction="row" spacing={1.5} alignItems="flex-start">
              <CategoryIcon category={c.category} sx={{ color: "primary.main", mt: 0.25 }} />
              <Stack spacing={0.5} sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 500 }}>
                  {c.landmark || t("nearby.distance", { m: c.distanceM })}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {c.landmark ? `${t("nearby.distance", { m: c.distanceM })} · ` : ""}
                  {t("nearby.reported", { date: formatDate(c.createdAt) })}
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  <StatusChip status={c.status} />
                  {c.supporterCount > 0 && (
                    <Typography variant="body2">
                      {t("nearby.count", { count: c.supporterCount })}
                    </Typography>
                  )}
                </Stack>
              </Stack>
            </Stack>
            <Button
              fullWidth
              sx={{ mt: 1 }}
              variant={c.supportedByMe ? "contained" : "outlined"}
              color="secondary"
              startIcon={<ThumbUpAltRounded />}
              aria-pressed={c.supportedByMe}
              disabled={toggle.isPending}
              onClick={() => toggle.mutate(c)}
            >
              {c.supportedByMe ? t("nearby.supported") : t("nearby.meToo")}
            </Button>
          </Paper>
        ))}
      </Stack>
      {anySupported && (
        <Stack spacing={1} sx={{ mt: 1.5 }}>
          <Typography>{t("nearby.noNeed")}</Typography>
          <Button variant="contained" onClick={onDone}>
            {t("nearby.done")}
          </Button>
        </Stack>
      )}
    </Paper>
  );
}
