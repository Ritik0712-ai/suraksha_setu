import { Box, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { PageTitle } from "../../components/ui/PageTitle.jsx";
import { HighlightCard } from "../../components/ui/Notice.jsx";

function Section({ title, items }) {
  return (
    <Box component="section">
      <Typography variant="h2" sx={{ mb: 1.5 }}>
        {title}
      </Typography>
      <Box component="ul" sx={{ pl: 3, m: 0, "& li": { mb: 1 } }}>
        {items.map((text) => (
          <li key={text}>
            <Typography>{text}</Typography>
          </li>
        ))}
      </Box>
    </Box>
  );
}

/** S-31 About. */
export function AboutPage() {
  const { t } = useTranslation("info");
  return (
    <Stack spacing={3} sx={{ maxWidth: 760 }}>
      <PageTitle>{t("about.title")}</PageTitle>
      <Typography>{t("about.what")}</Typography>
      <Typography>{t("about.pilot")}</Typography>
      <Typography>{t("about.project")}</Typography>
      <HighlightCard>
        <Typography sx={{ fontWeight: 500 }}>{t("about.notGov")}</Typography>
      </HighlightCard>
      <Typography>{t("about.helplines")}</Typography>
      <Box>
        <Typography variant="h2" sx={{ mb: 1 }}>
          {t("about.team")}
        </Typography>
        <Typography>{t("about.teamBody")}</Typography>
      </Box>
    </Stack>
  );
}

/** S-32 Privacy & data — plain language, from docs/05 §10. */
export function PrivacyPage() {
  const { t } = useTranslation("info");
  const list = (prefix, n) => Array.from({ length: n }, (_, i) => t(`${prefix}${i + 1}`));
  return (
    <Stack spacing={3} sx={{ maxWidth: 760 }}>
      <PageTitle subtitle={t("privacy.intro")}>{t("privacy.title")}</PageTitle>
      <Section title={t("privacy.collectTitle")} items={list("privacy.collect", 4)} />
      <Section title={t("privacy.seeTitle")} items={list("privacy.see", 3)} />
      <Section title={t("privacy.keepTitle")} items={list("privacy.keep", 4)} />
      <Box>
        <Typography variant="h2" sx={{ mb: 1.5 }}>
          {t("privacy.deleteTitle")}
        </Typography>
        <Typography>{t("privacy.deleteBody")}</Typography>
      </Box>
    </Stack>
  );
}
