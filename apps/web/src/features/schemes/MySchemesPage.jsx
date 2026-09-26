import { Box, Button, Chip, IconButton, LinearProgress, Stack, Typography } from "@mui/material";
import { BookmarksRounded, DeleteOutlineRounded } from "@mui/icons-material";
import { useQuery } from "@tanstack/react-query";
import { Link as RouterLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { apiError } from "../../api/client.js";
import { schemesApi } from "../../api/endpoints.js";
import { useLocalized } from "../../lib/localized.js";
import { PageTitle } from "../../components/ui/PageTitle.jsx";
import { EmptyState, ErrorCard, ListSkeleton } from "../../components/ui/States.jsx";
import { useSaveScheme } from "./useSaveScheme.js";

/** S-18 My schemes (docs/03): saved schemes with document progress. */
export default function MySchemesPage() {
  const { t } = useTranslation("schemes");
  const localized = useLocalized();
  const { onToggle } = useSaveScheme();
  const q = useQuery({ queryKey: ["saved-schemes"], queryFn: schemesApi.saved });

  return (
    <Stack spacing={2}>
      <PageTitle>{t("my.title")}</PageTitle>
      {q.isLoading && <ListSkeleton />}
      {q.isError && <ErrorCard network={apiError(q.error).network} onRetry={() => q.refetch()} />}
      {q.isSuccess && q.data.length === 0 && (
        <EmptyState
          icon={BookmarksRounded}
          title={t("my.empty")}
          action={
            <Button variant="contained" component={RouterLink} to="/schemes">
              {t("my.browse")}
            </Button>
          }
        />
      )}
      <Stack component="ul" spacing={1.5} sx={{ listStyle: "none", p: 0, m: 0 }}>
        {(q.data ?? []).map((s) => (
          <Box
            component="li"
            key={s.id}
            sx={{
              display: "flex",
              gap: 1,
              alignItems: "center",
              p: 2,
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 2,
              bgcolor: "background.paper",
            }}
          >
            <Stack
              spacing={1}
              component={RouterLink}
              to={`/schemes/${s.slug}`}
              sx={{ flex: 1, minWidth: 0, color: "inherit", textDecoration: "none" }}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography sx={{ fontWeight: 700 }}>{localized(s.name)}</Typography>
                {s.updated && <Chip size="small" color="secondary" label={t("my.updated")} />}
              </Stack>
              <Typography variant="body2" color="text.secondary">
                {t("my.docsReady", { ready: s.documentsReady, total: s.documentsTotal })}
              </Typography>
              <LinearProgress
                variant="determinate"
                value={s.documentsTotal ? (s.documentsReady / s.documentsTotal) * 100 : 0}
                aria-hidden
                sx={{ height: 8, borderRadius: 4, bgcolor: "primary.light" }}
              />
            </Stack>
            <IconButton
              onClick={() => onToggle(s.id)}
              aria-label={`${t("my.remove")}: ${localized(s.name)}`}
              sx={{ width: 48, height: 48 }}
            >
              <DeleteOutlineRounded />
            </IconButton>
          </Box>
        ))}
      </Stack>
    </Stack>
  );
}
