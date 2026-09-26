import { useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Stack,
  Typography,
} from "@mui/material";
import {
  CancelRounded,
  CheckCircleRounded,
  ExpandMoreRounded,
  HelpRounded,
  SearchOffRounded,
} from "@mui/icons-material";
import { Link as RouterLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLocalized } from "../../lib/localized.js";
import { useEligibility } from "../../stores/eligibility.js";
import { Notice } from "../../components/ui/Notice.jsx";
import { PageTitle } from "../../components/ui/PageTitle.jsx";
import { EmptyState } from "../../components/ui/States.jsx";
import { SchemeCard } from "./SchemeCard.jsx";
import { useSaveScheme } from "./useSaveScheme.js";

const GROUPS = [
  { key: "likely", Icon: CheckCircleRounded, color: "#0B6E0B" },
  { key: "maybe", Icon: HelpRounded, color: "#B45309" },
  { key: "no", Icon: CancelRounded, color: "#6B7280" },
];

/** S-17 Eligibility results (docs/03): likely / maybe / not eligible, with reasons. */
export default function EligibilityResultsPage() {
  const { t } = useTranslation("schemes");
  const localized = useLocalized();
  const results = useEligibility((s) => s.results);
  const { isSaved, onToggle } = useSaveScheme();
  const [open, setOpen] = useState({ likely: true, maybe: true, no: false });

  if (!results)
    return (
      <EmptyState
        headingLevel={1}
        icon={HelpRounded}
        title={t("results.noAnswers")}
        action={
          <Button variant="contained" component={RouterLink} to="/schemes/check">
            {t("results.start")}
          </Button>
        }
      />
    );

  const found = results.counts.likely + results.counts.maybe;
  // "Ask Sahayak" carries a short summary of the results as the first question (docs/03 S-17).
  const names = results.results
    .filter((r) => r.result !== "no")
    .slice(0, 5)
    .map((r) => localized(r.name))
    .join(", ");
  const sahayakLink = names
    ? `/sahayak?q=${encodeURIComponent(t("askSahayakPrompt", { names }))}`
    : "/sahayak";
  return (
    <Stack spacing={2.5} sx={{ maxWidth: 760, mx: "auto", pb: 4 }}>
      <PageTitle sx={{ mb: 0 }}>{t("results.title")}</PageTitle>
      {found > 0 ? (
        <Typography sx={{ fontSize: "1.25rem", fontWeight: 500 }}>
          {t("results.summary", { count: found })}
        </Typography>
      ) : (
        <EmptyState
          icon={SearchOffRounded}
          title={t("results.empty")}
          action={
            <Button variant="outlined" component={RouterLink} to="/sahayak">
              {t("askSahayak")}
            </Button>
          }
        />
      )}
      {GROUPS.map(({ key, Icon, color }) => {
        const items = results.results.filter((r) => r.result === key);
        if (!items.length) return null;
        return (
          <Accordion
            key={key}
            expanded={open[key]}
            onChange={(_e, v) => setOpen((o) => ({ ...o, [key]: v }))}
            disableGutters
            variant="outlined"
            sx={{ borderRadius: 2, "&:before": { display: "none" } }}
          >
            <AccordionSummary expandIcon={<ExpandMoreRounded />}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Icon sx={{ color }} />
                <Typography variant="h2" component="h2" sx={{ fontSize: "1.25rem" }}>
                  {t(`results.${key}`)} ({items.length})
                </Typography>
              </Stack>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={1.5}>
                {items.map((r) => (
                  <SchemeCard
                    key={r.id}
                    scheme={r}
                    saved={isSaved(r.id)}
                    onToggleSave={onToggle}
                    footer={
                      r.reasons.length > 0 && (
                        <Box component="ul" sx={{ m: 0, pl: 2.5, color: "text.secondary" }}>
                          {r.reasons.map((x, i) => (
                            <Typography component="li" variant="body2" key={i}>
                              {localized(x)}
                            </Typography>
                          ))}
                        </Box>
                      )
                    }
                  />
                ))}
              </Stack>
            </AccordionDetails>
          </Accordion>
        );
      })}
      <Stack spacing={1.5}>
        <Button variant="outlined" component={RouterLink} to="/schemes/check">
          {t("results.change")}
        </Button>
        <Button variant="outlined" component={RouterLink} to={sahayakLink}>
          {t("askSahayak")}
        </Button>
      </Stack>
      <Notice title={t("detail.disclaimer")} />
    </Stack>
  );
}
