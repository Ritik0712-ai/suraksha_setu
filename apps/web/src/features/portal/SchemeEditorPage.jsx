import { useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  Checkbox,
  Divider,
  FormControlLabel,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { AddRounded, ArrowBackRounded, DeleteOutlineRounded } from "@mui/icons-material";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link as RouterLink, useBlocker, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import C from "../../config/constants.js";
import { apiError } from "../../api/client.js";
import { adminApi } from "../../api/endpoints.js";
import { formatDate } from "../../lib/time.js";
import { toast } from "../../stores/toast.js";
import { ConfirmDialog, ResponsiveDialog } from "../../components/ui/ResponsiveDialog.jsx";
import { ErrorCard, ListSkeleton } from "../../components/ui/States.jsx";
import { Section } from "./ui.jsx";
import { blankScheme, fromApi, slugify, toBody } from "./schemeForm.js";

const FIELDS = Object.keys(C.eligibilityAnswers).filter(
  (k) => k !== "$comment" && k !== "unknownValues",
);
const MULTI = new Set(["in", "nin"]);

/** Hindi | English inputs side by side (docs/03 A-09). */
function LText({ label, value, onChange, multiline = false, id }) {
  const { t } = useTranslation("portal");
  return (
    <Box>
      <Typography sx={{ fontWeight: 500, mb: 0.5 }}>{label}</Typography>
      <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" } }}>
        {["hi", "en"].map((lang) => (
          <TextField
            key={lang}
            id={`${id}-${lang}`}
            label={t(`editor.${lang}`)}
            value={value?.[lang] ?? ""}
            onChange={(e) => onChange({ ...value, [lang]: e.target.value })}
            multiline={multiline}
            minRows={multiline ? 2 : undefined}
            size="small"
            fullWidth
          />
        ))}
      </Box>
    </Box>
  );
}

function LList({ label, items, onChange, id }) {
  const { t } = useTranslation("portal");
  return (
    <Stack spacing={1}>
      <Typography sx={{ fontWeight: 500 }}>{label}</Typography>
      {items.map((item, i) => (
        <Stack key={i} direction="row" spacing={1} alignItems="flex-start">
          <Box sx={{ flex: 1 }}>
            <LText
              label={`${i + 1}.`}
              id={`${id}-${i}`}
              value={item}
              onChange={(v) => onChange(items.map((x, k) => (k === i ? v : x)))}
              multiline
            />
          </Box>
          <IconButton
            aria-label={`${t("editor.remove")} ${i + 1}`}
            onClick={() => onChange(items.filter((_, k) => k !== i))}
            sx={{ mt: 3 }}
          >
            <DeleteOutlineRounded />
          </IconButton>
        </Stack>
      ))}
      <Button
        startIcon={<AddRounded />}
        onClick={() => onChange([...items, { hi: "", en: "" }])}
        sx={{ alignSelf: "flex-start" }}
      >
        {t("editor.addItem")}
      </Button>
    </Stack>
  );
}

function ConditionRow({ cond, onChange, onRemove, idx, group }) {
  const { t } = useTranslation("portal");
  const values = C.eligibilityAnswers[cond.field] ?? [];
  const multi = MULTI.has(cond.op);
  const label = (v) => t(`check.a.${cond.field}.${v}`, { ns: "schemes", defaultValue: v });
  return (
    <Box sx={{ p: 1.5, border: "1px dashed", borderColor: "divider", borderRadius: 2 }}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ md: "center" }}>
        <TextField
          select
          size="small"
          label={t("editor.field")}
          value={cond.field}
          onChange={(e) =>
            onChange({ ...cond, field: e.target.value, value: MULTI.has(cond.op) ? [] : "" })
          }
          sx={{ minWidth: 180 }}
        >
          {FIELDS.map((f) => (
            <MenuItem key={f} value={f}>
              {t(`check.q.${f}`, { ns: "schemes" })}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label={t("editor.op")}
          value={cond.op}
          onChange={(e) =>
            onChange({ ...cond, op: e.target.value, value: MULTI.has(e.target.value) ? [] : "" })
          }
          sx={{ minWidth: 140 }}
        >
          {C.eligibilityOps.map((o) => (
            <MenuItem key={o} value={o}>
              {t(`editor.ops.${o}`)}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label={t("editor.value")}
          value={multi ? (Array.isArray(cond.value) ? cond.value : []) : (cond.value ?? "")}
          onChange={(e) => onChange({ ...cond, value: e.target.value })}
          SelectProps={{
            multiple: multi,
            renderValue: multi ? (v) => v.map(label).join(", ") : undefined,
          }}
          sx={{ minWidth: 200, flex: 1 }}
        >
          {values.map((v) => (
            <MenuItem key={v} value={v}>
              {label(v)}
            </MenuItem>
          ))}
        </TextField>
        <IconButton aria-label={`${t("editor.remove")} ${group} ${idx + 1}`} onClick={onRemove}>
          <DeleteOutlineRounded />
        </IconButton>
      </Stack>
      <Stack spacing={1} sx={{ mt: 1 }}>
        <LText
          label={t("editor.failReason")}
          id={`${group}-${idx}-fail`}
          value={cond.failReason}
          onChange={(v) => onChange({ ...cond, failReason: v })}
        />
        <LText
          label={t("editor.unknownReason")}
          id={`${group}-${idx}-unknown`}
          value={cond.unknownReason}
          onChange={(v) => onChange({ ...cond, unknownReason: v })}
        />
      </Stack>
    </Box>
  );
}

function RulesBuilder({ rules, onChange }) {
  const { t } = useTranslation("portal");
  const blank = () => ({
    field: "gender",
    op: "eq",
    value: "",
    failReason: { hi: "", en: "" },
    unknownReason: { hi: "", en: "" },
  });
  const group = (key) => (
    <Stack spacing={1}>
      <Typography sx={{ fontWeight: 500 }}>{t(`editor.${key}`)}</Typography>
      {rules[key].map((c, i) => (
        <ConditionRow
          key={i}
          idx={i}
          group={key}
          cond={c}
          onChange={(v) =>
            onChange({ ...rules, [key]: rules[key].map((x, k) => (k === i ? v : x)) })
          }
          onRemove={() => onChange({ ...rules, [key]: rules[key].filter((_, k) => k !== i) })}
        />
      ))}
      <Button
        startIcon={<AddRounded />}
        onClick={() => onChange({ ...rules, [key]: [...rules[key], blank()] })}
        sx={{ alignSelf: "flex-start" }}
      >
        {t("editor.addCondition")}
      </Button>
    </Stack>
  );
  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        {t("editor.rulesHint")}
      </Typography>
      {group("all")}
      {group("any")}
      <LList
        label={t("editor.alwaysCheck")}
        id="always"
        items={rules.alwaysCheck}
        onChange={(v) => onChange({ ...rules, alwaysCheck: v })}
      />
    </Stack>
  );
}

function Preview({ open, onClose, v }) {
  const { t } = useTranslation("portal");
  const [lang, setLang] = useState("hi");
  const L = (x) => x?.[lang] ?? "";
  const list = (items) => (
    <Box component="ul" sx={{ m: 0, pl: 3 }}>
      {items.map((x, i) => (
        <li key={i}>{L(x)}</li>
      ))}
    </Box>
  );
  return (
    <ResponsiveDialog
      open={open}
      onClose={onClose}
      title={t("editor.preview")}
      labelId="preview-title"
      actions={<Button onClick={onClose}>{t("actions.close", { ns: "common" })}</Button>}
    >
      <Stack spacing={1.5}>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={lang}
          onChange={(_e, x) => x && setLang(x)}
        >
          <ToggleButton value="hi">हिन्दी</ToggleButton>
          <ToggleButton value="en">English</ToggleButton>
        </ToggleButtonGroup>
        <Typography variant="h2">{L(v.name)}</Typography>
        <Typography>{L(v.summary)}</Typography>
        <Typography sx={{ fontWeight: 700 }}>
          {t(`detail.benefits`, { ns: "schemes", lng: lang })}
        </Typography>
        {list(v.benefits)}
        <Typography sx={{ fontWeight: 700 }}>
          {t(`detail.eligibility`, { ns: "schemes", lng: lang })}
        </Typography>
        {list(v.eligibilityText)}
        <Typography sx={{ fontWeight: 700 }}>
          {t(`detail.documents`, { ns: "schemes", lng: lang })}
        </Typography>
        {list(v.documents.map((k) => C.schemeDocuments.find((d) => d.key === k)?.label))}
        <Typography sx={{ fontWeight: 700 }}>
          {t(`detail.how`, { ns: "schemes", lng: lang })}
        </Typography>
        <Box component="ol" sx={{ m: 0, pl: 3 }}>
          {v.howToApply.map((x, i) => (
            <li key={i}>{L(x)}</li>
          ))}
        </Box>
        <Typography sx={{ fontWeight: 700 }}>
          {t(`detail.where`, { ns: "schemes", lng: lang })}
        </Typography>
        {list(v.whereToApply)}
        <Typography variant="body2">
          {v.sourceName} — {v.officialUrl}
        </Typography>
      </Stack>
    </ResponsiveDialog>
  );
}

/** A-09 Scheme editor (docs/03). */
export default function SchemeEditorPage() {
  const { t } = useTranslation("portal");
  const { id } = useParams();
  const isNew = id === "new";
  const navigate = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin", "scheme", id],
    queryFn: () => adminApi.scheme(id),
    enabled: !isNew,
  });
  const [v, setV] = useState(isNew ? blankScheme() : null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(false);
  const slugTouched = useRef(!isNew);
  const leaving = useRef(false);

  useEffect(() => {
    if (q.data) {
      setV(fromApi(q.data));
      setDirty(false);
    }
  }, [q.data]);

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && !leaving.current && currentLocation.pathname !== nextLocation.pathname,
  );

  const update = (patch) => {
    setV((x) => {
      const next = { ...x, ...patch };
      if (patch.name && !slugTouched.current) next.slug = slugify(patch.name.en ?? "");
      return next;
    });
    setDirty(true);
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const body = toBody(v);
      const saved = isNew
        ? await adminApi.createScheme(body)
        : await adminApi.updateScheme(id, body);
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["admin", "schemes"] });
      toast(t("editor.saved"));
      if (isNew) {
        leaving.current = true;
        navigate(`/portal/admin/schemes/${saved.id}`, { replace: true });
      } else qc.setQueryData(["admin", "scheme", id], saved);
      return saved;
    } catch (err) {
      const e = apiError(err);
      setError(
        e.details?.length ? `${e.message}: ${e.details.map((d) => d.field).join(", ")}` : e.message,
      );
      return null;
    } finally {
      setBusy(false);
    }
  };

  const publish = async (verify) => {
    const saved = dirty || isNew ? await save() : q.data;
    if (!saved) return;
    setBusy(true);
    try {
      if (verify) await adminApi.schemeAction(saved.id, "verify");
      const pub = await adminApi.schemeAction(saved.id, "publish");
      qc.setQueryData(["admin", "scheme", saved.id], pub);
      qc.invalidateQueries({ queryKey: ["admin", "schemes"] });
      toast(t("editor.published"));
    } catch (err) {
      setError(apiError(err).message);
    } finally {
      setBusy(false);
    }
  };

  if (!isNew && q.isLoading) return <ListSkeleton rows={5} />;
  if (!isNew && q.isError)
    return <ErrorCard network={apiError(q.error).network} onRetry={() => q.refetch()} />;
  if (!v) return <ListSkeleton rows={5} />;
  const current = q.data;

  return (
    <Stack spacing={2} sx={{ pb: 10 }}>
      <Box>
        <Button component={RouterLink} to="/portal/admin/schemes" startIcon={<ArrowBackRounded />}>
          {t("schemesAdmin.title")}
        </Button>
      </Box>
      <Typography variant="h1">{t(isNew ? "editor.newTitle" : "editor.editTitle")}</Typography>
      {current && (
        <Typography color="text.secondary">
          {t("editor.status", { status: t(`schemesAdmin.status.${current.status}`) })} ·{" "}
          {t("editor.lastVerified", {
            date: current.lastVerifiedAt ? formatDate(current.lastVerifiedAt) : t("editor.never"),
          })}
        </Typography>
      )}

      <Section title={t("editor.basic")}>
        <Stack spacing={2}>
          <LText
            label={t("editor.name")}
            id="name"
            value={v.name}
            onChange={(x) => update({ name: x })}
          />
          <TextField
            label={t("editor.slug")}
            value={v.slug}
            onChange={(e) => {
              slugTouched.current = true;
              update({ slug: e.target.value });
            }}
            size="small"
          />
          <Box>
            <Typography sx={{ fontWeight: 500 }}>{t("editor.categories")}</Typography>
            <Stack direction="row" flexWrap="wrap" useFlexGap>
              {C.schemeCategories.map((c) => (
                <FormControlLabel
                  key={c}
                  control={
                    <Checkbox
                      checked={v.categories.includes(c)}
                      onChange={(e) =>
                        update({
                          categories: e.target.checked
                            ? [...v.categories, c]
                            : v.categories.filter((x) => x !== c),
                        })
                      }
                    />
                  }
                  label={t(`categories.${c}`, { ns: "schemes" })}
                />
              ))}
            </Stack>
          </Box>
          <Stack direction="row" spacing={1.5}>
            <TextField
              select
              size="small"
              label={t("editor.level")}
              value={v.level}
              onChange={(e) =>
                update({
                  level: e.target.value,
                  state: e.target.value === "state" ? v.state || "MP" : "",
                })
              }
              sx={{ minWidth: 160 }}
            >
              {C.schemeLevels.map((l) => (
                <MenuItem key={l} value={l}>
                  {t(`level.${l}`, { ns: "schemes" })}
                </MenuItem>
              ))}
            </TextField>
            {v.level === "state" && (
              <TextField
                size="small"
                label={t("editor.state")}
                value={v.state}
                onChange={(e) => update({ state: e.target.value })}
                sx={{ width: 120 }}
              />
            )}
          </Stack>
          <TextField
            size="small"
            label={t("editor.tags")}
            value={v.tags}
            onChange={(e) => update({ tags: e.target.value })}
          />
          <LText
            label={t("editor.summary")}
            id="summary"
            value={v.summary}
            onChange={(x) => update({ summary: x })}
            multiline
          />
          <LText
            label={t("editor.benefitShort")}
            id="benefitShort"
            value={v.benefitShort}
            onChange={(x) => update({ benefitShort: x })}
          />
        </Stack>
      </Section>
      <Section>
        <Stack spacing={3}>
          <LList
            label={t("editor.benefits")}
            id="benefits"
            items={v.benefits}
            onChange={(x) => update({ benefits: x })}
          />
          <Divider />
          <LList
            label={t("editor.eligibilityText")}
            id="eligibility"
            items={v.eligibilityText}
            onChange={(x) => update({ eligibilityText: x })}
          />
        </Stack>
      </Section>
      <Section title={t("editor.rules")}>
        <RulesBuilder rules={v.rules} onChange={(x) => update({ rules: x })} />
      </Section>
      <Section title={t("editor.documents")}>
        <Stack direction="row" flexWrap="wrap" useFlexGap>
          {C.schemeDocuments.map((d) => (
            <FormControlLabel
              key={d.key}
              control={
                <Checkbox
                  checked={v.documents.includes(d.key)}
                  onChange={(e) =>
                    update({
                      documents: e.target.checked
                        ? [...v.documents, d.key]
                        : v.documents.filter((x) => x !== d.key),
                    })
                  }
                />
              }
              label={d.label.hi + " / " + d.label.en}
              sx={{ width: { xs: "100%", md: "48%" } }}
            />
          ))}
        </Stack>
      </Section>
      <Section>
        <Stack spacing={3}>
          <LList
            label={t("editor.howToApply")}
            id="how"
            items={v.howToApply}
            onChange={(x) => update({ howToApply: x })}
          />
          <Divider />
          <LList
            label={t("editor.whereToApply")}
            id="where"
            items={v.whereToApply}
            onChange={(x) => update({ whereToApply: x })}
          />
          <Divider />
          <TextField
            size="small"
            label={t("editor.officialUrl")}
            value={v.officialUrl}
            onChange={(e) => update({ officialUrl: e.target.value })}
          />
          <TextField
            size="small"
            label={t("editor.sourceName")}
            value={v.sourceName}
            onChange={(e) => update({ sourceName: e.target.value })}
          />
          <TextField
            size="small"
            label={t("editor.helpline")}
            value={v.helpline}
            onChange={(e) => update({ helpline: e.target.value })}
          />
        </Stack>
      </Section>

      {error && (
        <Typography color="error" role="alert">
          {error}
        </Typography>
      )}
      <Stack
        direction="row"
        spacing={1}
        flexWrap="wrap"
        useFlexGap
        sx={{
          position: "sticky",
          bottom: 0,
          py: 1.5,
          bgcolor: "#F4F6FA",
          borderTop: "1px solid",
          borderColor: "divider",
          zIndex: 2,
        }}
      >
        <Button variant="contained" onClick={save} disabled={busy}>
          {t("editor.save")}
        </Button>
        <Button variant="outlined" onClick={() => setPreview(true)}>
          {t("editor.preview")}
        </Button>
        {current?.lastVerifiedAt && !current.stale ? (
          <Button
            variant="contained"
            color="success"
            onClick={() => publish(false)}
            disabled={busy}
          >
            {t("editor.publish")}
          </Button>
        ) : (
          <Button variant="contained" color="success" onClick={() => publish(true)} disabled={busy}>
            {t("editor.verifyPublish")}
          </Button>
        )}
      </Stack>
      <Preview open={preview} onClose={() => setPreview(false)} v={v} />
      <ConfirmDialog
        open={blocker.state === "blocked"}
        title={t("editor.leaveTitle")}
        body={t("editor.leaveBody")}
        confirmLabel={t("editor.leave")}
        cancelLabel={t("editor.stay")}
        onCancel={() => blocker.reset?.()}
        onConfirm={() => blocker.proceed?.()}
      />
    </Stack>
  );
}
