import { useState } from "react";
import {
  Alert,
  Button,
  Checkbox,
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
import { AddRounded } from "@mui/icons-material";
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
import { BiField } from "./fields.jsx";
import { Section } from "./ui.jsx";

function DepartmentForm({ dept, onClose }) {
  const { t } = useTranslation("portal");
  const localized = useLocalized();
  const qc = useQueryClient();
  const jurs = useQuery({ queryKey: ["admin", "jurisdictions"], queryFn: adminApi.jurisdictions });
  const [v, setV] = useState({
    name: dept?.name ?? { hi: "", en: "" },
    code: dept?.code ?? "",
    jurisdictionId: dept?.jurisdictionId ?? "",
    handlesCategories: dept?.handlesCategories ?? [],
    contactPhone: dept?.contactPhone ?? "",
    contactEmail: dept?.contactEmail ?? "",
    active: dept?.active ?? true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (p) => setV((x) => ({ ...x, ...p }));
  const submit = async () => {
    setBusy(true);
    setError(null);
    const body = {
      ...v,
      contactPhone: v.contactPhone || null,
      contactEmail: v.contactEmail || null,
    };
    try {
      if (dept) await adminApi.updateDepartment(dept.id, body);
      else await adminApi.createDepartment(body);
      qc.invalidateQueries({ queryKey: ["admin", "departments"] });
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
      title={t(dept ? "departments.formEdit" : "departments.formAdd")}
      labelId="dept-form-title"
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
          label={t("departments.name")}
          id="dept-name"
          value={v.name}
          onChange={(x) => set({ name: x })}
        />
        <TextField
          size="small"
          label={t("departments.code")}
          value={v.code}
          onChange={(e) => set({ code: e.target.value.toUpperCase() })}
        />
        <TextField
          select
          size="small"
          label={t("departments.jurisdiction")}
          value={v.jurisdictionId}
          onChange={(e) => set({ jurisdictionId: e.target.value })}
        >
          {(jurs.data ?? []).map((j) => (
            <MenuItem key={j.id} value={j.id}>
              {localized(j.name)} ({t(`jurisdictions.types.${j.type}`)})
            </MenuItem>
          ))}
        </TextField>
        <Typography sx={{ fontWeight: 500 }}>{t("departments.categories")}</Typography>
        <Stack direction="row" flexWrap="wrap" useFlexGap>
          {C.complaintCategories.map((c) => (
            <FormControlLabel
              key={c}
              control={
                <Checkbox
                  checked={v.handlesCategories.includes(c)}
                  onChange={(e) =>
                    set({
                      handlesCategories: e.target.checked
                        ? [...v.handlesCategories, c]
                        : v.handlesCategories.filter((x) => x !== c),
                    })
                  }
                />
              }
              label={t(`categories.${c}`, { ns: "complaints" })}
            />
          ))}
        </Stack>
        <TextField
          size="small"
          label={t("departments.phone")}
          value={v.contactPhone}
          onChange={(e) => set({ contactPhone: e.target.value })}
        />
        <TextField
          size="small"
          label={t("departments.email")}
          value={v.contactEmail}
          onChange={(e) => set({ contactEmail: e.target.value })}
        />
        <FormControlLabel
          control={
            <Switch checked={v.active} onChange={(e) => set({ active: e.target.checked })} />
          }
          label={t("departments.active")}
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

/** A-11 Departments & routing (docs/03). Admin only. */
export default function DepartmentsPage() {
  const { t } = useTranslation("portal");
  const localized = useLocalized();
  const [form, setForm] = useState(null);
  const q = useQuery({ queryKey: ["admin", "departments"], queryFn: adminApi.departments });
  const items = q.data?.items ?? [];
  const gaps = q.data?.gaps ?? [];
  const cat = (c) => t(`categories.${c}`, { ns: "complaints" });
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
        <PageTitle sx={{ mb: 0 }}>{t("departments.title")}</PageTitle>
        <Button variant="contained" startIcon={<AddRounded />} onClick={() => setForm("new")}>
          {t("departments.add")}
        </Button>
      </Stack>
      {q.isLoading && <ListSkeleton />}
      {q.isError && <ErrorCard network={apiError(q.error).network} onRetry={() => q.refetch()} />}
      {q.isSuccess && (
        <Section title={t("departments.gaps")}>
          {gaps.length === 0 ? (
            <Typography color="text.secondary">{t("departments.noGaps")}</Typography>
          ) : (
            <Stack spacing={1}>
              {gaps.map((g) => (
                <Alert
                  key={`${g.villageId}-${g.category}`}
                  severity={g.fallback ? "warning" : "error"}
                >
                  {t(g.fallback ? "departments.gap" : "departments.gapNone", {
                    category: cat(g.category),
                    village: localized(g.village),
                  })}
                </Alert>
              ))}
            </Stack>
          )}
        </Section>
      )}
      {items.length > 0 && (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                {["name", "code", "jurisdiction", "categories", "contact", "active"].map((c) => (
                  <TableCell key={c}>{t(`departments.cols.${c}`)}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((d) => (
                <TableRow key={d.id} hover sx={{ cursor: "pointer" }} onClick={() => setForm(d)}>
                  <TableCell>
                    <Typography sx={{ fontWeight: 500 }}>{d.name.hi}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {d.name.en}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ fontFamily: "monospace" }}>{d.code}</TableCell>
                  <TableCell>{localized(d.jurisdiction)}</TableCell>
                  <TableCell>
                    {d.handlesCategories.length ? d.handlesCategories.map(cat).join(", ") : "—"}
                  </TableCell>
                  <TableCell>
                    {[d.contactPhone, d.contactEmail].filter(Boolean).join(" · ") || "—"}
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={t(`common.${d.active ? "active" : "inactive"}`)}
                      color={d.active ? "success" : "default"}
                      variant="outlined"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      {form && <DepartmentForm dept={form === "new" ? null : form} onClose={() => setForm(null)} />}
    </Stack>
  );
}
