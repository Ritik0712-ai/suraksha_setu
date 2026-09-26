import { useEffect, useRef } from "react";
import { Box, Button, ButtonBase, Fab, Stack, Typography } from "@mui/material";
import { AddRounded, AssignmentRounded } from "@mui/icons-material";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Link as RouterLink, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { apiError } from "../../api/client.js";
import { complaintsApi } from "../../api/endpoints.js";
import { formatDateTime, timeAgo } from "../../lib/time.js";
import { FilterChips } from "../../components/ui/FilterChips.jsx";
import { PageTitle } from "../../components/ui/PageTitle.jsx";
import { EmptyState, ErrorCard, ListSkeleton } from "../../components/ui/States.jsx";
import { StatusChip } from "../../components/ui/StatusChip.jsx";
import { CategoryIcon } from "./categories.jsx";
import { useLocalized } from "./complaintUtils.js";

const FILTERS = ["all", "open", "resolved", "rejected"];

function ComplaintCard({ c }) {
  const { t } = useTranslation("complaints");
  const localized = useLocalized();
  const place = c.landmark || localized(c.village);
  return (
    <ButtonBase
      component={RouterLink}
      to={`/complaints/${c.id}`}
      sx={{
        display: "flex",
        alignItems: "stretch",
        gap: 1.5,
        p: 1.5,
        borderRadius: 2,
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
        textAlign: "left",
        justifyContent: "flex-start",
        "&:focus-visible": { outline: "3px solid #C2410C", outlineOffset: 2 },
      }}
    >
      <Box
        sx={{
          width: 72,
          height: 72,
          flexShrink: 0,
          borderRadius: 1.5,
          overflow: "hidden",
          bgcolor: "primary.light",
          display: "grid",
          placeItems: "center",
        }}
      >
        {c.imageUrl ? (
          <Box
            component="img"
            src={c.imageUrl}
            alt=""
            loading="lazy"
            sx={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <CategoryIcon category={c.category} sx={{ fontSize: 36, color: "primary.main" }} />
        )}
      </Box>
      <Stack spacing={0.5} sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 700 }}>{t(`categories.${c.category}`)}</Typography>
        <Typography variant="body2" color="text.secondary">
          {c.complaintNo} · {formatDateTime(c.createdAt)}
        </Typography>
        {place && (
          <Typography variant="body2" noWrap>
            {place}
          </Typography>
        )}
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <StatusChip status={c.status} size="small" />
          <Typography variant="body2" color="text.secondary">
            {t("list.updated", { ago: timeAgo(c.updatedAt) })}
          </Typography>
        </Stack>
      </Stack>
    </ButtonBase>
  );
}

/** S-12 My complaints (docs/03): filter chips, 20 per page, infinite scroll, FAB. */
export default function MyComplaintsPage() {
  const { t } = useTranslation("complaints");
  const [params, setParams] = useSearchParams();
  const filter = FILTERS.includes(params.get("status")) ? params.get("status") : "all";
  const sentinel = useRef(null);

  const q = useInfiniteQuery({
    queryKey: ["complaints", "mine", filter],
    queryFn: ({ pageParam }) =>
      complaintsApi.mine({ page: pageParam, ...(filter === "all" ? {} : { status: filter }) }),
    initialPageParam: 1,
    getNextPageParam: (last) => last.nextPage ?? undefined,
  });
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];

  // Infinite scroll: load the next page when the end of the list comes into view.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !q.hasNextPage || typeof IntersectionObserver === "undefined") return undefined;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !q.isFetchingNextPage) q.fetchNextPage();
    });
    io.observe(el);
    return () => io.disconnect();
  }, [q.hasNextPage, q.isFetchingNextPage, q]);

  const setFilter = (v) => setParams(v === "all" ? {} : { status: v }, { replace: true });

  return (
    <Box sx={{ pb: 10 }}>
      <PageTitle>{t("list.title")}</PageTitle>
      <Box sx={{ mb: 2 }}>
        <FilterChips
          scroll
          label={t("list.filterLabel")}
          value={filter}
          onChange={setFilter}
          options={FILTERS.map((f) => ({ value: f, label: t(`list.filters.${f}`) }))}
        />
      </Box>

      {q.isLoading && <ListSkeleton onRetry={() => q.refetch()} />}
      {q.isError && <ErrorCard network={apiError(q.error).network} onRetry={() => q.refetch()} />}
      {q.isSuccess && items.length === 0 && filter === "all" && (
        <EmptyState
          icon={AssignmentRounded}
          title={t("list.emptyTitle")}
          body={t("list.emptyBody")}
          action={
            <Button variant="contained" component={RouterLink} to="/complaints/new">
              {t("modules.report", { ns: "common" })}
            </Button>
          }
        />
      )}
      {q.isSuccess && items.length === 0 && filter !== "all" && (
        <Typography color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
          {t("list.emptyFilter")}
        </Typography>
      )}

      <Stack spacing={1.5} component="ul" sx={{ listStyle: "none", p: 0, m: 0 }}>
        {items.map((c) => (
          <Box component="li" key={c.id}>
            <ComplaintCard c={c} />
          </Box>
        ))}
      </Stack>
      {q.hasNextPage && (
        <Box ref={sentinel} sx={{ py: 2, textAlign: "center" }}>
          <Button onClick={() => q.fetchNextPage()} disabled={q.isFetchingNextPage}>
            {q.isFetchingNextPage ? t("list.loadingMore") : t("actions.next", { ns: "common" })}
          </Button>
        </Box>
      )}

      <Fab
        variant="extended"
        color="primary"
        component={RouterLink}
        to="/complaints/new"
        sx={{
          position: "fixed",
          right: 16,
          bottom: { xs: "calc(88px + env(safe-area-inset-bottom))", md: 24 },
          zIndex: 5,
        }}
      >
        <AddRounded sx={{ mr: 1 }} />
        {t("list.new")}
      </Fab>
    </Box>
  );
}
