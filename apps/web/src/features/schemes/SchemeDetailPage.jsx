import { useState } from "react";
import {
  Box,
  Button,
  Checkbox,
  Chip,
  FormControlLabel,
  Link,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import {
  AssignmentRounded,
  BookmarkBorderRounded,
  BookmarkRounded,
  CardGiftcardRounded,
  FactCheckRounded,
  GroupsRounded,
  LocationOnRounded,
  OpenInNewRounded,
  PhoneRounded,
  SearchOffRounded,
  ShareRounded,
  StairsRounded,
} from "@mui/icons-material";
import { SahayakIcon } from "../../components/icons/index.jsx";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { apiError } from "../../api/client.js";
import { chatApi, schemesApi } from "../../api/endpoints.js";
import { useSession } from "../../stores/session.js";
import { copyText } from "../../lib/device.js";
import { useLocalized } from "../../lib/localized.js";
import { formatDate } from "../../lib/time.js";
import { toast } from "../../stores/toast.js";
import { Notice } from "../../components/ui/Notice.jsx";
import { EmptyState, ErrorCard, ListSkeleton } from "../../components/ui/States.jsx";
import { ListenButton } from "../../components/ui/Speech.jsx";
import { WhatsAppShare } from "../../components/ui/WhatsAppShare.jsx";
import { HelpfulVote } from "../../components/ui/HelpfulVote.jsx";
import { useMyFeedback } from "../../lib/feedback.js";
import { cachedScheme, cacheScheme, isNetworkError } from "./cache.js";
import { CATEGORY_ICONS } from "./icons.js";
import { LevelBadge } from "./SchemeCard.jsx";
import { useSaveScheme } from "./useSaveScheme.js";

const STALE_DAYS = 90; // docs/05 §5.8

function Section({ icon: Icon, title, children }) {
  return (
    <Box component="section">
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <Icon color="primary" />
        <Typography variant="h2" sx={{ fontSize: "1.25rem" }}>
          {title}
        </Typography>
      </Stack>
      {children}
    </Box>
  );
}

function Bullets({ items, ordered = false }) {
  const localized = useLocalized();
  return (
    <Box component={ordered ? "ol" : "ul"} sx={{ m: 0, pl: 3, "& li": { mb: 0.75 } }}>
      {items.map((x, i) => (
        <Typography component="li" key={i}>
          {localized(x)}
        </Typography>
      ))}
    </Box>
  );
}

/** Document checklist; ticks are saved for citizens who saved the scheme (docs/03 S-15 §5). */
function Documents({ scheme }) {
  const { t } = useTranslation("schemes");
  const localized = useLocalized();
  const qc = useQueryClient();
  const checked = new Set(scheme.saved?.checkedDocuments ?? []);
  const save = useMutation({
    mutationFn: (keys) => schemesApi.save(scheme.id, { checkedDocuments: keys }),
    onMutate: (keys) =>
      qc.setQueryData(["scheme", scheme.slug], (old) =>
        old ? { ...old, saved: { checkedDocuments: keys } } : old,
      ),
    onSettled: () => qc.invalidateQueries({ queryKey: ["saved-schemes"] }),
    onError: (err) => toast(apiError(err).message, "error"),
  });
  const toggle = (key) => {
    const next = new Set(checked);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    save.mutate([...next]);
  };
  if (!scheme.saved)
    return (
      <>
        <List dense disablePadding>
          {scheme.documents.map((d) => (
            <ListItem key={d.key} disableGutters>
              <ListItemIcon sx={{ minWidth: 36 }}>
                <AssignmentRounded color="primary" />
              </ListItemIcon>
              <ListItemText
                primary={localized(d.label)}
                primaryTypographyProps={{ fontSize: "1rem" }}
              />
            </ListItem>
          ))}
        </List>
        <Typography variant="body2" color="text.secondary">
          {t("detail.docsHint")}
        </Typography>
      </>
    );
  return (
    <Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        {t("detail.docsReady", { ready: checked.size, total: scheme.documents.length })}
      </Typography>
      {scheme.documents.map((d) => (
        <FormControlLabel
          key={d.key}
          control={<Checkbox checked={checked.has(d.key)} onChange={() => toggle(d.key)} />}
          label={localized(d.label)}
          sx={{ minHeight: 48 }}
        />
      ))}
    </Stack>
  );
}

/** S-15 Scheme detail (docs/03). */
export default function SchemeDetailPage() {
  const { t } = useTranslation("schemes");
  const localized = useLocalized();
  const { slug } = useParams();
  const navigate = useNavigate();
  const { isSaved, onToggle } = useSaveScheme();
  const citizen = useSession((x) => x.status === "authed" && x.user?.role === "citizen");
  const [asking, setAsking] = useState(false);

  const q = useQuery({
    queryKey: ["scheme", slug],
    queryFn: async () => {
      try {
        const s = await schemesApi.get(slug);
        cacheScheme(s);
        return s;
      } catch (err) {
        const cached = cachedScheme(slug);
        if (isNetworkError(err) && cached) return { ...cached, offline: true, saved: null };
        throw err;
      }
    },
    retry: (n, err) => apiError(err).status !== 404 && n < 2,
  });
  const schemeId = q.data && !q.data.offline ? q.data.id : null;
  const votes = useMyFeedback("scheme", [schemeId]);

  if (q.isLoading) return <ListSkeleton rows={5} />;
  if (q.isError) {
    const e = apiError(q.error);
    if (e.status === 404)
      return (
        <EmptyState
          headingLevel={1}
          icon={SearchOffRounded}
          title={t("detail.notFound")}
          action={
            <Button variant="contained" component={RouterLink} to="/schemes">
              {t("detail.allSchemes")}
            </Button>
          }
        />
      );
    return <ErrorCard network={e.network} onRetry={() => q.refetch()} />;
  }

  const s = q.data;
  const name = localized(s.name);

  // FR-SCH-06: opens Sahayak with this scheme loaded (a scheme_help session).
  const askSahayak = async () => {
    if (!citizen) {
      navigate(`/login?next=${encodeURIComponent(`/schemes/${s.slug}`)}`);
      return;
    }
    setAsking(true);
    try {
      const session = await chatApi.start({ mode: "scheme_help", schemeId: s.id });
      navigate(`/sahayak/${session.id}`, { state: { session } });
    } catch (err) {
      const x = apiError(err);
      toast(x.network ? t("states.networkError", { ns: "common" }) : x.message, "error");
      setAsking(false);
    }
  };
  const saved = isSaved(s.id) || Boolean(s.saved);
  const stale =
    !s.lastVerifiedAt || Date.now() - new Date(s.lastVerifiedAt) > STALE_DAYS * 86400_000;

  // The whole page as one text for 🔊 (headings + items), in the reading order of the screen.
  const listenText = [
    name,
    localized(s.summary),
    ...[
      ["detail.benefits", s.benefits],
      ["detail.eligibility", s.eligibilityText],
      ["detail.documents", s.documents.map((d) => d.label)],
      ["detail.how", s.howToApply],
      ["detail.where", s.whereToApply],
    ].flatMap(([key, items]) => [`${t(key)}.`, ...(items ?? []).map((x) => `${localized(x)}.`)]),
  ].join("\n");
  const whatsappText = t("detail.whatsappText", {
    name,
    benefit: localized(s.benefitShort),
    url: `${window.location.origin}/schemes/${s.slug}`,
  });

  const share = async () => {
    const text = t("detail.shareText", { name, benefit: localized(s.benefitShort) });
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: name, text, url });
        return;
      } catch (err) {
        if (err?.name === "AbortError") return;
      }
    }
    if (await copyText(`${text}\n${url}`)) toast(t("detail.shareCopied"));
  };

  return (
    <Stack spacing={3} sx={{ maxWidth: 760, mx: "auto", pb: 4 }}>
      {s.offline && <Notice kind="warning">{t("offlineCached")}</Notice>}
      <Stack spacing={1.5}>
        <Typography variant="h1">{name}</Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
          <LevelBadge level={s.level} />
          {s.categories.map((c) => {
            const Icon = CATEGORY_ICONS[c];
            return (
              <Chip
                key={c}
                size="small"
                icon={Icon ? <Icon /> : undefined}
                label={t(`categories.${c}`)}
                variant="outlined"
              />
            );
          })}
        </Stack>
        <Typography sx={{ fontSize: "1.125rem" }}>{localized(s.summary)}</Typography>
        <ListenButton
          variant="button"
          text={listenText}
          label={t("detail.listenAll")}
          sx={{ alignSelf: { sm: "flex-start" }, minHeight: 48 }}
        />
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Button
            variant={saved ? "contained" : "outlined"}
            startIcon={saved ? <BookmarkRounded /> : <BookmarkBorderRounded />}
            onClick={() => onToggle(s.id)}
            aria-pressed={saved}
            disabled={s.offline}
          >
            {t(saved ? "saved" : "save")}
          </Button>
          <Button variant="outlined" startIcon={<ShareRounded />} onClick={share}>
            {t("detail.share")}
          </Button>
          <WhatsAppShare text={whatsappText} />
        </Stack>
      </Stack>

      {/* Trust line (docs/03 S-15 §2). */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography>
          {t("detail.source")}:{" "}
          <Link href={s.officialUrl} target="_blank" rel="noopener" sx={{ fontWeight: 500 }}>
            {s.sourceName} <OpenInNewRounded sx={{ fontSize: 16, verticalAlign: "middle" }} />
          </Link>
          {s.lastVerifiedAt && (
            <>
              {" · "}
              {t("detail.lastChecked")}: {formatDate(s.lastVerifiedAt)}
            </>
          )}
        </Typography>
        {stale && (
          <Box sx={{ mt: 1.5 }}>
            <Notice kind="warning">{t("detail.stale")}</Notice>
          </Box>
        )}
      </Paper>

      <Section icon={CardGiftcardRounded} title={t("detail.benefits")}>
        <Bullets items={s.benefits} />
      </Section>
      <Section icon={GroupsRounded} title={t("detail.eligibility")}>
        <Bullets items={s.eligibilityText} />
      </Section>
      <Section icon={AssignmentRounded} title={t("detail.documents")}>
        <Documents scheme={s} />
      </Section>
      <Section icon={StairsRounded} title={t("detail.how")}>
        <Bullets items={s.howToApply} ordered />
      </Section>
      <Section icon={LocationOnRounded} title={t("detail.where")}>
        <Bullets items={s.whereToApply} />
      </Section>
      {s.helpline && (
        <Section icon={PhoneRounded} title={t("detail.helpline")}>
          <Button variant="outlined" startIcon={<PhoneRounded />} href={`tel:${s.helpline}`}>
            {t("detail.callHelpline", { number: s.helpline })}
          </Button>
        </Section>
      )}

      <Stack spacing={1.5}>
        <Button
          variant="contained"
          startIcon={<FactCheckRounded />}
          component={RouterLink}
          to="/schemes/check"
        >
          {t("detail.check")}
        </Button>
        <Button
          variant="outlined"
          startIcon={<SahayakIcon />}
          onClick={askSahayak}
          disabled={asking || Boolean(s.offline)}
        >
          {t("detail.askSahayak")}
        </Button>
        <Button
          variant="outlined"
          endIcon={<OpenInNewRounded />}
          href={s.officialUrl}
          target="_blank"
          rel="noopener"
        >
          {t("detail.official")}
        </Button>
      </Stack>
      {schemeId && citizen && (
        <Paper variant="outlined" sx={{ px: 2, py: 1 }}>
          <HelpfulVote
            target="scheme"
            targetId={schemeId}
            ids={[schemeId]}
            value={votes.data?.[schemeId]}
            label={t("detail.helpful")}
          />
        </Paper>
      )}
      <Notice kind="info" title={t("detail.disclaimer")} />
    </Stack>
  );
}
