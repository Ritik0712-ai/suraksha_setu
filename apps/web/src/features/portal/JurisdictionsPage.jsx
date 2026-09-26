import { useState } from "react";
import {
  Box,
  Button,
  Chip,
  FormControlLabel,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { AddRounded, EditRounded } from "@mui/icons-material";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import C from "../../config/constants.js";
import { apiError } from "../../api/client.js";
import { adminApi } from "../../api/endpoints.js";
import { useLocalized } from "../../lib/localized.js";
import { toast } from "../../stores/toast.js";
import { PageTitle } from "../../components/ui/PageTitle.jsx";
import { ResponsiveDialog } from "../../components/ui/ResponsiveDialog.jsx";
import { ErrorCard, ListSkeleton } from "../../components/ui/States.jsx";
import { SubmitButton } from "../../components/ui/fields.jsx";
import { BiField, PointField } from "./fields.jsx";

const TYPES = C.jurisdictionTypes;

function JurisdictionForm({ node, parentId, all, onClose }) {
  const { t } = useTranslation("portal");
  const localized = useLocalized();
  const qc = useQueryClient();
  const depts = useQuery({ queryKey: ["admin", "departments"], queryFn: adminApi.departments });
  const parent = all.find((j) => j.id === (node?.parentId ?? parentId));
  const childType = parent
    ? TYPES[Math.min(TYPES.indexOf(parent.type) + 1, TYPES.length - 1)]
    : TYPES[0];
  const [v, setV] = useState({
    name: node?.name ?? { hi: "", en: "" },
    type: node?.type ?? childType,
    parentId: node?.parentId ?? parentId ?? "",
    point: node
      ? { lat: String(node.centroid.lat), lng: String(node.centroid.lng) }
      : {
          lat: parent ? String(parent.centroid.lat) : "",
          lng: parent ? String(parent.centroid.lng) : "",
        },
    boundary: node?.boundary ? JSON.stringify(node.boundary) : "",
    defaultDepartmentId: node?.defaultDepartmentId ?? "",
    active: node?.active ?? true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (p) => setV((x) => ({ ...x, ...p }));
  const submit = async () => {
    setError(null);
    let boundary = null;
    if (v.boundary.trim()) {
      try {
        boundary = JSON.parse(v.boundary);
        if (!["Polygon", "MultiPolygon"].includes(boundary?.type)) throw new Error();
      } catch {
        return setError(t("jurisdictions.boundaryInvalid"));
      }
    }
    setBusy(true);
    const body = {
      name: v.name,
      type: v.type,
      parentId: v.parentId || null,
      centroid: { lat: Number(v.point.lat), lng: Number(v.point.lng) },
      boundary,
      defaultDepartmentId: v.defaultDepartmentId || null,
      active: v.active,
    };
    try {
      if (node) await adminApi.updateJurisdiction(node.id, body);
      else await adminApi.createJurisdiction(body);
      qc.invalidateQueries({ queryKey: ["admin", "jurisdictions"] });
      toast(t("common.updated"));
      onClose();
    } catch (err) {
      const e = apiError(err);
      setError(
        e.details?.length ? `${e.message}: ${e.details.map((d) => d.field).join(", ")}` : e.message,
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <ResponsiveDialog
      open
      onClose={busy ? undefined : onClose}
      title={
        node
          ? t("jurisdictions.formEdit", { name: localized(node.name) })
          : t("jurisdictions.formAdd")
      }
      labelId="jur-form-title"
      actions={
        <>
          <Button variant="outlined" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <SubmitButton type="button" busy={busy} onClick={submit}>
            {t("common.save")}
          </SubmitButton>
        </>
      }
    >
      <Stack spacing={2} sx={{ pt: 1 }}>
        <BiField
          label={t("jurisdictions.name")}
          id="jur-name"
          value={v.name}
          onChange={(x) => set({ name: x })}
        />
        <TextField
          select
          size="small"
          label={t("jurisdictions.type")}
          value={v.type}
          onChange={(e) => set({ type: e.target.value })}
        >
          {TYPES.map((x) => (
            <MenuItem key={x} value={x}>
              {t(`jurisdictions.types.${x}`)}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label={t("jurisdictions.parent")}
          value={v.parentId}
          onChange={(e) => set({ parentId: e.target.value })}
          SelectProps={{ displayEmpty: true }}
        >
          <MenuItem value="">{t("jurisdictions.noParent")}</MenuItem>
          {all
            .filter((j) => j.id !== node?.id && TYPES.indexOf(j.type) < TYPES.indexOf(v.type))
            .map((j) => (
              <MenuItem key={j.id} value={j.id}>
                {localized(j.name)} ({t(`jurisdictions.types.${j.type}`)})
              </MenuItem>
            ))}
        </TextField>
        <PointField
          value={v.point}
          onChange={(p) => set({ point: p })}
          latLabel={t("jurisdictions.lat")}
          lngLabel={t("jurisdictions.lng")}
          hint={t("directory.pinHint")}
        />
        <TextField
          size="small"
          label={t("jurisdictions.boundary")}
          value={v.boundary}
          onChange={(e) => set({ boundary: e.target.value })}
          multiline
          minRows={2}
        />
        <TextField
          select
          size="small"
          label={t("jurisdictions.defaultDept")}
          value={v.defaultDepartmentId}
          onChange={(e) => set({ defaultDepartmentId: e.target.value })}
          SelectProps={{ displayEmpty: true }}
        >
          <MenuItem value="">{t("jurisdictions.noDept")}</MenuItem>
          {(depts.data?.items ?? []).map((d) => (
            <MenuItem key={d.id} value={d.id}>
              {localized(d.name)}
            </MenuItem>
          ))}
        </TextField>
        <FormControlLabel
          control={
            <Switch checked={v.active} onChange={(e) => set({ active: e.target.checked })} />
          }
          label={t("jurisdictions.active")}
        />
        {error && (
          <Typography color="error" role="alert">
            {error}
          </Typography>
        )}
      </Stack>
    </ResponsiveDialog>
  );
}

function Node({ node, byParent, depth, onEdit, onAdd }) {
  const { t } = useTranslation("portal");
  const localized = useLocalized();
  const kids = byParent.get(node.id) ?? [];
  return (
    <Box component="li" sx={{ listStyle: "none" }}>
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        sx={{ pl: depth * 3, py: 0.5, minHeight: 44 }}
      >
        <Typography sx={{ fontWeight: depth < 2 ? 700 : 500, opacity: node.active ? 1 : 0.5 }}>
          {localized(node.name)}
        </Typography>
        <Chip size="small" label={t(`jurisdictions.types.${node.type}`)} variant="outlined" />
        {node.hasBoundary && (
          <Chip
            size="small"
            label={t("jurisdictions.hasBoundary")}
            color="info"
            variant="outlined"
          />
        )}
        <Box sx={{ flex: 1 }} />
        <Tooltip title={t("common.edit")}>
          <IconButton
            size="small"
            aria-label={`${t("common.edit")}: ${localized(node.name)}`}
            onClick={() => onEdit(node)}
          >
            <EditRounded fontSize="small" />
          </IconButton>
        </Tooltip>
        {node.type !== "village" && (
          <Tooltip title={t("jurisdictions.addChild", { name: localized(node.name) })}>
            <IconButton
              size="small"
              aria-label={t("jurisdictions.addChild", { name: localized(node.name) })}
              onClick={() => onAdd(node.id)}
            >
              <AddRounded fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Stack>
      {kids.length > 0 && (
        <Box component="ul" sx={{ p: 0, m: 0 }}>
          {kids.map((k) => (
            <Node
              key={k.id}
              node={k}
              byParent={byParent}
              depth={depth + 1}
              onEdit={onEdit}
              onAdd={onAdd}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}

/** A-12 Jurisdictions (docs/03): tree view, add/edit nodes. Admin only. */
export default function JurisdictionsPage() {
  const { t } = useTranslation("portal");
  const [form, setForm] = useState(null); // { node } | { parentId }
  const q = useQuery({ queryKey: ["admin", "jurisdictions"], queryFn: adminApi.jurisdictions });
  const all = q.data ?? [];
  const byParent = new Map();
  for (const j of all) {
    const k = j.parentId ?? "root";
    if (!byParent.has(k)) byParent.set(k, []);
    byParent.get(k).push(j);
  }
  const roots = all.filter((j) => !j.parentId || !all.some((x) => x.id === j.parentId));
  return (
    <Stack spacing={2}>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        flexWrap="wrap"
        useFlexGap
        spacing={1}
      >
        <PageTitle sx={{ mb: 0 }}>{t("jurisdictions.title")}</PageTitle>
        <Button
          variant="contained"
          startIcon={<AddRounded />}
          onClick={() => setForm({ parentId: null })}
        >
          {t("jurisdictions.add")}
        </Button>
      </Stack>
      {q.isLoading && <ListSkeleton />}
      {q.isError && <ErrorCard network={apiError(q.error).network} onRetry={() => q.refetch()} />}
      {all.length > 0 && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Box component="ul" sx={{ p: 0, m: 0 }}>
            {roots.map((r) => (
              <Node
                key={r.id}
                node={r}
                byParent={byParent}
                depth={0}
                onEdit={(node) => setForm({ node })}
                onAdd={(parentId) => setForm({ parentId })}
              />
            ))}
          </Box>
        </Paper>
      )}
      {form && (
        <JurisdictionForm
          node={form.node}
          parentId={form.parentId}
          all={all}
          onClose={() => setForm(null)}
        />
      )}
    </Stack>
  );
}
