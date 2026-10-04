import { useState } from "react";
import { Box, Button, LinearProgress, Paper, Stack, Typography } from "@mui/material";
import { AssignmentTurnedInRounded } from "@mui/icons-material";
import { useQuery } from "@tanstack/react-query";
import { Link as RouterLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { schemesApi } from "../../api/endpoints.js";
import { useLocalized } from "../../lib/localized.js";
import { readJSON, writeJSON } from "../../lib/storage.js";
import { ListenButton } from "../../components/ui/Speech.jsx";

const SNOOZE_KEY = "ss_scheme_reminders_snooze";
const SNOOZE_DAYS = 7;
const SHOW = 2;

/**
 * Home-screen reminder for saved schemes whose document checklist isn't complete: "Laadli
 * Behna — 1 of 3 documents ready. Still needed: Samagra ID, Bank passbook". "Later" hides a
 * scheme for a week (on this phone). Citizens with saved schemes only.
 */
export function SchemeReminders() {
  const { t } = useTranslation("home");
  const localized = useLocalized();
  const [snoozed, setSnoozed] = useState(() => readJSON(SNOOZE_KEY, {}) ?? {});
  const q = useQuery({
    queryKey: ["saved-schemes"],
    queryFn: schemesApi.saved,
    staleTime: 5 * 60_000,
  });
  const now = Date.now();
  const due = (q.data ?? [])
    .filter((s) => s.documentsTotal > 0 && s.documentsReady < s.documentsTotal)
    .filter((s) => !(snoozed[s.id] > now))
    .slice(0, SHOW);
  if (!due.length) return null;

  const later = (id) => {
    const next = { ...snoozed, [id]: now + SNOOZE_DAYS * 86400_000 };
    writeJSON(SNOOZE_KEY, next);
    setSnoozed(next);
  };

  return (
    <Box component="section" aria-labelledby="reminders-heading">
      <Typography id="reminders-heading" variant="h2" sx={{ fontSize: "1.25rem", mb: 1 }}>
        {t("reminders.title")}
      </Typography>
      <Stack spacing={1.5}>
        {due.map((s) => {
          const name = localized(s.name);
          const missing = (s.missingDocuments ?? []).map((d) => localized(d.label));
          const status = t("reminders.ready", { ready: s.documentsReady, total: s.documentsTotal });
          const need = missing.length ? t("reminders.need", { list: missing.join(", ") }) : "";
          return (
            <Paper
              key={s.id}
              variant="outlined"
              sx={{ p: 2, borderLeft: 6, borderLeftColor: "secondary.main" }}
            >
              <Stack direction="row" spacing={1.5} alignItems="flex-start">
                <AssignmentTurnedInRounded color="secondary" sx={{ mt: 0.25 }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 700 }}>{name}</Typography>
                  <Typography variant="body2">{status}</Typography>
                  <LinearProgress
                    variant="determinate"
                    value={(s.documentsReady / s.documentsTotal) * 100}
                    sx={{ my: 1, height: 8, borderRadius: 4 }}
                    aria-label={status}
                  />
                  {need && <Typography>{need}</Typography>}
                </Box>
                <ListenButton text={`${name}. ${status}. ${need}`} size="small" />
              </Stack>
              <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                <Button variant="contained" component={RouterLink} to={`/schemes/${s.slug}`}>
                  {t("reminders.tick")}
                </Button>
                <Button onClick={() => later(s.id)}>{t("reminders.later")}</Button>
              </Stack>
            </Paper>
          );
        })}
      </Stack>
    </Box>
  );
}
