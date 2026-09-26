import { useState } from "react";
import {
  Button,
  Chip,
  FormControlLabel,
  MenuItem,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { AddRounded, DownloadRounded, UploadFileRounded } from "@mui/icons-material";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import C from "../../config/constants.js";
import { apiError } from "../../api/client.js";
import { adminApi } from "../../api/endpoints.js";
import { formatDistance } from "../../lib/geo.js";
import { downloadBlob, useLocalized } from "../../lib/localized.js";
import { formatDate } from "../../lib/time.js";
import { toast } from "../../stores/toast.js";
import { PageTitle } from "../../components/ui/PageTitle.jsx";
import { ResponsiveDialog } from "../../components/ui/ResponsiveDialog.jsx";
import { ErrorCard, ListSkeleton } from "../../components/ui/States.jsx";
import { SubmitButton } from "../../components/ui/fields.jsx";
import { BiField, PointField } from "./fields.jsx";

const empty = () => ({
  name: { hi: "", en: "" },
  type: "hospital",
  address: { hi: "", en: "" },
  phones: "",
  point: { lat: "", lng: "" },
  is24x7: false,
  notes: { hi: "", en: "" },
  verifiedOn: new Date().toISOString().slice(0, 10),
  active: true,
});

function ServiceForm({ service, onClose }) {
  const { t } = useTranslation("portal");
  const qc = useQueryClient();
  const [v, setV] = useState(
    service
      ? {
          name: service.name,
          type: service.type,
          address: service.address,
          phones: service.phones.join("; "),
          point: { lat: String(service.lat), lng: String(service.lng) },
          is24x7: Boolean(service.is24x7),
          notes: service.notes ?? { hi: "", en: "" },
          verifiedOn: String(service.verifiedAt).slice(0, 10),
          active: service.active,
        }
      : empty(),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (patch) => setV((x) => ({ ...x, ...patch }));
  const submit = async () => {
    setBusy(true);
    setError(null);
    const notes =
      v.notes.hi.trim() || v.notes.en.trim()
        ? { hi: v.notes.hi || v.notes.en, en: v.notes.en || v.notes.hi }
        : null;
    const body = {
      name: v.name,
      type: v.type,
      address: v.address,
      phones: v.phones
        .split(";")
        .map((p) => p.trim())
        .filter(Boolean),
      lat: Number(v.point.lat),
      lng: Number(v.point.lng),
      is24x7: v.is24x7,
      notes,
      verifiedOn: v.verifiedOn,
      active: v.active,
    };
    try {
      if (service) await adminApi.updateService(service.id, body);
      else await adminApi.createService(body);
      qc.invalidateQueries({ queryKey: ["admin", "services"] });
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
      title={t(service ? "directory.formEdit" : "directory.formAdd")}
      labelId="service-form-title"
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
          label={t("directory.name")}
          id="svc-name"
          value={v.name}
          onChange={(x) => set({ name: x })}
        />
        <TextField
          select
          size="small"
          label={t("directory.cols.type")}
          value={v.type}
          onChange={(e) => set({ type: e.target.value })}
        >
          {C.serviceTypes.map((s) => (
            <MenuItem key={s} value={s}>
              {t(`types.${s}`, { ns: "emergency" })}
            </MenuItem>
          ))}
        </TextField>
        <BiField
          label={t("directory.address")}
          id="svc-address"
          value={v.address}
          onChange={(x) => set({ address: x })}
        />
        <TextField
          size="small"
          label={t("directory.phones")}
          value={v.phones}
          onChange={(e) => set({ phones: e.target.value })}
        />
        <PointField
          value={v.point}
          onChange={(p) => set({ point: p })}
          latLabel={t("directory.lat")}
          lngLabel={t("directory.lng")}
          hint={t("directory.pinHint")}
        />
        <FormControlLabel
          control={
            <Switch checked={v.is24x7} onChange={(e) => set({ is24x7: e.target.checked })} />
          }
          label={t("directory.open24")}
        />
        <BiField
          label={t("directory.notes")}
          id="svc-notes"
          value={v.notes}
          onChange={(x) => set({ notes: x })}
        />
        <TextField
          size="small"
          type="date"
          label={t("directory.verifiedOn")}
          value={v.verifiedOn}
          onChange={(e) => set({ verifiedOn: e.target.value })}
          inputProps={{ max: new Date().toISOString().slice(0, 10) }}
        />
        <FormControlLabel
          control={
            <Switch checked={v.active} onChange={(e) => set({ active: e.target.checked })} />
          }
          label={t("directory.active")}
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

function ImportDialog({ onClose }) {
  const { t } = useTranslation("portal");
  const qc = useQueryClient();
  const [csv, setCsv] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const { imported } = await adminApi.importServices(csv);
      qc.invalidateQueries({ queryKey: ["admin", "services"] });
      toast(t("directory.imported", { n: imported }));
      onClose();
    } catch (err) {
      const e = apiError(err);
      setError([e.message, ...(e.details ?? []).map((d) => `${d.field}: ${d.issue}`)].join("\n"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <ResponsiveDialog
      open
      onClose={busy ? undefined : onClose}
      title={t("directory.importTitle")}
      labelId="import-title"
      actions={
        <>
          <Button variant="outlined" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <SubmitButton type="button" busy={busy} disabled={busy || !csv} onClick={submit}>
            {t("directory.import")}
          </SubmitButton>
        </>
      }
    >
      <Stack spacing={2}>
        <Typography>{t("directory.importHint")}</Typography>
        <Button variant="outlined" component="label" startIcon={<UploadFileRounded />}>
          {name || t("directory.chooseFile")}
          <input
            hidden
            type="file"
            accept=".csv,text/csv"
            data-testid="csv-input"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setName(f.name);
              setCsv(await f.text());
            }}
          />
        </Button>
        {error && (
          <Typography color="error" role="alert" sx={{ whiteSpace: "pre-wrap" }}>
            {error}
          </Typography>
        )}
      </Stack>
    </ResponsiveDialog>
  );
}

/** A-10 Emergency directory (docs/03). Admin only. */
export default function EmergencyDirectoryPage() {
  const { t } = useTranslation("portal");
  const localized = useLocalized();
  const [form, setForm] = useState(null);
  const [importing, setImporting] = useState(false);
  const q = useQuery({ queryKey: ["admin", "services"], queryFn: adminApi.services });
  const template = async () =>
    downloadBlob(await adminApi.serviceTemplate(), "emergency_services_template.csv");
  const items = q.data ?? [];
  const dist = (m) => formatDistance((k, o) => t(`directory.${k}`, o), m);

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
        <PageTitle sx={{ mb: 0 }}>{t("directory.title")}</PageTitle>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Button startIcon={<DownloadRounded />} onClick={template}>
            {t("directory.template")}
          </Button>
          <Button
            variant="outlined"
            startIcon={<UploadFileRounded />}
            onClick={() => setImporting(true)}
          >
            {t("directory.import")}
          </Button>
          <Button variant="contained" startIcon={<AddRounded />} onClick={() => setForm("new")}>
            {t("directory.add")}
          </Button>
        </Stack>
      </Stack>
      {q.isLoading && <ListSkeleton />}
      {q.isError && <ErrorCard network={apiError(q.error).network} onRetry={() => q.refetch()} />}
      {q.isSuccess && items.length === 0 && (
        <Typography color="text.secondary">{t("directory.empty")}</Typography>
      )}
      {items.length > 0 && (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                {["name", "type", "place", "phone", "distance", "verified", "active"].map((c) => (
                  <TableCell key={c}>{t(`directory.cols.${c}`)}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((s) => (
                <TableRow key={s.id} hover sx={{ cursor: "pointer" }} onClick={() => setForm(s)}>
                  <TableCell sx={{ fontWeight: 500 }}>{localized(s.name)}</TableCell>
                  <TableCell>{t(`types.${s.type}`, { ns: "emergency" })}</TableCell>
                  <TableCell>{localized(s.address)}</TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{s.phones.join(", ")}</TableCell>
                  <TableCell>{dist(s.distanceM)}</TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{formatDate(s.verifiedAt)}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={t(`common.${s.active ? "active" : "inactive"}`)}
                      color={s.active ? "success" : "default"}
                      variant="outlined"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      {form && <ServiceForm service={form === "new" ? null : form} onClose={() => setForm(null)} />}
      {importing && <ImportDialog onClose={() => setImporting(false)} />}
    </Stack>
  );
}
