import { useEffect, useState } from "react";
import { Box, Button, InputAdornment, Stack, TextField, Typography } from "@mui/material";
import { FactCheckRounded, SearchRounded, SearchOffRounded } from "@mui/icons-material";
import { useQuery } from "@tanstack/react-query";
import { Link as RouterLink, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import C from "../../config/constants.js";
import { apiError } from "../../api/client.js";
import { FilterChips } from "../../components/ui/FilterChips.jsx";
import { HighlightCard, Notice } from "../../components/ui/Notice.jsx";
import { PageTitle } from "../../components/ui/PageTitle.jsx";
import { EmptyState, ErrorCard, ListSkeleton } from "../../components/ui/States.jsx";
import { listParams, schemesListQuery } from "./listQuery.js";
import { CATEGORY_ICONS } from "./icons.js";
import { SchemeCard } from "./SchemeCard.jsx";
import { useSaveScheme } from "./useSaveScheme.js";

const DEBOUNCE_MS = 300; // docs/03 S-14

/** S-14 Schemes list (docs/03). */
export default function SchemesPage() {
  const { t } = useTranslation("schemes");
  const [params, setParams] = useSearchParams();
  const { category, q } = listParams(params);
  const [text, setText] = useState(q);
  const { isSaved, onToggle } = useSaveScheme();

  // Debounced search into the URL (shareable, back-button safe).
  useEffect(() => {
    const id = setTimeout(() => {
      if (text.trim() === q) return;
      const next = new URLSearchParams(params);
      if (text.trim()) next.set("q", text.trim());
      else next.delete("q");
      setParams(next, { replace: true });
    }, DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [text, q, params, setParams]);

  const list = useQuery(schemesListQuery({ category, q }));

  const setCategory = (v) => {
    const next = new URLSearchParams(params);
    if (v) next.set("category", v);
    else next.delete("category");
    setParams(next, { replace: true });
  };

  const items = list.data?.items ?? [];
  return (
    <Stack spacing={2.5}>
      <PageTitle subtitle={t("subtitle")} sx={{ mb: 0 }}>
        {t("title")}
      </PageTitle>
      <HighlightCard>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }}>
          <FactCheckRounded sx={{ fontSize: 40, color: "#C2410C" }} />
          <Typography sx={{ flex: 1, fontWeight: 500, fontSize: "1.125rem" }}>
            {t("cta.title")}
          </Typography>
          <Button variant="contained" color="secondary" component={RouterLink} to="/schemes/check">
            {t("cta.action")}
          </Button>
        </Stack>
      </HighlightCard>
      <TextField
        id="scheme-search"
        type="search"
        label={t("searchLabel")}
        placeholder={t("searchPlaceholder")}
        value={text}
        onChange={(e) => setText(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchRounded />
            </InputAdornment>
          ),
        }}
        fullWidth
      />
      <FilterChips
        scroll
        label={t("categoryLabel")}
        value={category}
        onChange={setCategory}
        options={[
          { value: "", label: t("categories.all") },
          ...C.schemeCategories.map((c) => {
            const Icon = CATEGORY_ICONS[c];
            return { value: c, label: t(`categories.${c}`), icon: <Icon /> };
          }),
        ]}
      />
      {list.data?.offline && <Notice kind="warning">{t("offlineCached")}</Notice>}
      {list.isLoading && <ListSkeleton onRetry={() => list.refetch()} />}
      {list.isError && (
        <ErrorCard network={apiError(list.error).network} onRetry={() => list.refetch()} />
      )}
      {list.isSuccess &&
        items.length === 0 &&
        (q ? (
          <EmptyState
            icon={SearchOffRounded}
            title={t("emptySearch", { q })}
            action={
              <Button
                variant="outlined"
                component={RouterLink}
                to={`/sahayak?q=${encodeURIComponent(q)}`}
              >
                {t("askSahayak")}
              </Button>
            }
          />
        ) : (
          <Typography color="text.secondary" sx={{ py: 3, textAlign: "center" }}>
            {t("emptyCategory")}
          </Typography>
        ))}
      <Box
        component="ul"
        sx={{
          listStyle: "none",
          p: 0,
          m: 0,
          display: "grid",
          gap: 1.5,
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
        }}
      >
        {items.map((s) => (
          <li key={s.id}>
            <SchemeCard scheme={s} saved={isSaved(s.id)} onToggleSave={onToggle} />
          </li>
        ))}
      </Box>
    </Stack>
  );
}
