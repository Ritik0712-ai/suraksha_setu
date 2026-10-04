import { useState } from "react";
import {
  Box,
  Button,
  ButtonBase,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  TextField,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { DownloadRounded, FilterAltOffRounded } from "@mui/icons-material";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import C from "../../config/constants.js";
import { apiError } from "../../api/client.js";
import { adminApi, complaintsApi } from "../../api/endpoints.js";
import { downloadBlob, useLocalized } from "../../lib/localized.js";
import { formatDateTime, timeAgo } from "../../lib/time.js";
import { toast } from "../../stores/toast.js";
import { ErrorCard, ListSkeleton } from "../../components/ui/States.jsx";
import { StatusChip } from "../../components/ui/StatusChip.jsx";
import { PageTitle } from "../../components/ui/PageTitle.jsx";
import { CategoryIcon } from "../complaints/categories.jsx";
import { MeTooBadge } from "./ui.jsx";

const LIMITS = [20, 50, 100];
const SORTABLE = { created: "created", age: "age", updated: "updated" };

/** Reads the A-02 filters from the URL (shareable, back-button safe; docs/03 A-02). */
function useFilters() {
  const [params, setParams] = useSearchParams();
  const list = (k) => (params.get(k) ? params.get(k).split(",").filter(Boolean) : []);
  const f = {
    q: params.get("q") ?? "",
    status: list("status"),
    category: list("category"),
    departmentId: params.get("departmentId") ?? "",
    villageId: params.get("villageId") ?? "",
    from: params.get("from") ?? "",
    to: params.get("to") ?? "",
    sort: params.get("sort") ?? "created",
    order: params.get("order") ?? "desc",
    page: Number(params.get("page") ?? 1),
    limit: LIMITS.includes(Number(params.get("limit"))) ? Number(params.get("limit")) : 20,
  };
  const set = (patch) => {
    const next = { ...f, ...patch };
    if (!("page" in patch)) next.page = 1;
    const out = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) {
      const val = Array.isArray(v) ? v.join(",") : String(v ?? "");
      const isDefault =
        (k === "sort" && val === "created") ||
        (k === "order" && val === "desc") ||
        (k === "page" && val === "1") ||
        (k === "limit" && val === "20");
      if (val && !isDefault) out.set(k, val);
    }
    setParams(out, { replace: true });
  };
  const apiParams = () => {
    const p = { sort: f.sort, order: f.order, page: f.page, limit: f.limit };
    for (const k of ["q", "departmentId", "villageId", "from", "to"]) if (f[k]) p[k] = f[k];
    if (f.status.length) p.status = f.status.join(",");
    if (f.category.length) p.category = f.category.join(",");
    return p;
  };
  return { f, set, apiParams, reset: () => setParams({}, { replace: true }) };
}

function MultiSelect({ label, value, options, onChange, id }) {
  return (
    <FormControl size="small" sx={{ minWidth: 180 }}>
      <InputLabel id={`${id}-label`} shrink>
        {label}
      </InputLabel>
      <Select
        labelId={`${id}-label`}
        id={id}
        multiple
        value={value}
        onChange={(e) =>
          onChange(typeof e.target.value === "string" ? e.target.value.split(",") : e.target.value)
        }
        input={<OutlinedInput notched label={label} />}
        renderValue={(v) => v.map((x) => options.find((o) => o.value === x)?.label ?? x).join(", ")}
        displayEmpty
      >
        {options.map((o) => (
          <MenuItem key={o.value} value={o.value}>
            {o.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

/** A-02 Complaints table (docs/03). */
export default function ComplaintsTablePage() {
  const { t } = useTranslation("portal");
  const localized = useLocalized();
  const navigate = useNavigate();
  const desktop = useMediaQuery((th) => th.breakpoints.up("md"));
  const { f, set, apiParams, reset } = useFilters();
  const [exporting, setExporting] = useState(false);
  const meta = useQuery({
    queryKey: ["admin", "meta"],
    queryFn: adminApi.meta,
    staleTime: 5 * 60_000,
  });
  const q = useQuery({
    queryKey: ["admin", "complaints", apiParams()],
    queryFn: () => complaintsApi.list(apiParams()),
    placeholderData: (prev) => prev,
  });
  const filtered = Boolean(
    f.q || f.status.length || f.category.length || f.departmentId || f.villageId || f.from || f.to,
  );

  const exportCsv = async () => {
    setExporting(true);
    try {
      const { page: _p, limit: _l, ...params } = apiParams();
      const blob = await complaintsApi.exportCsv(params);
      downloadBlob(blob, `complaints_${f.from || "all"}_${f.to || "all"}.csv`);
    } catch (err) {
      toast(apiError(err).message, "error");
    } finally {
      setExporting(false);
    }
  };

  const sortHeader = (col, label) => (
    <TableSortLabel
      active={f.sort === col}
      direction={f.sort === col ? f.order : "desc"}
      onClick={() =>
        set({ sort: col, order: f.sort === col && f.order === "desc" ? "asc" : "desc" })
      }
      aria-label={t("complaints.sortBy", { col: label })}
    >
      {label}
    </TableSortLabel>
  );

  const items = q.data?.items ?? [];
  const open = (id) => navigate(`/portal/complaints/${id}`);

  return (
    <Stack spacing={2}>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        spacing={1}
        flexWrap="wrap"
        useFlexGap
      >
        <PageTitle sx={{ mb: 0 }}>{t("complaints.title")}</PageTitle>
        <Button
          variant="outlined"
          startIcon={<DownloadRounded />}
          onClick={exportCsv}
          disabled={exporting}
        >
          {exporting ? t("complaints.exporting") : t("common.exportCsv")}
        </Button>
      </Stack>

      <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap alignItems="center">
        <TextField
          size="small"
          label={t("complaints.searchNo")}
          value={f.q}
          onChange={(e) => set({ q: e.target.value })}
          placeholder="SS-2026-000123"
        />
        <MultiSelect
          id="f-status"
          label={t("complaints.status")}
          value={f.status}
          onChange={(v) => set({ status: v })}
          options={C.complaintStatus.map((s) => ({
            value: s,
            label: t(`status.${s}`, { ns: "common" }),
          }))}
        />
        <MultiSelect
          id="f-category"
          label={t("complaints.category")}
          value={f.category}
          onChange={(v) => set({ category: v })}
          options={C.complaintCategories.map((c) => ({
            value: c,
            label: t(`categories.${c}`, { ns: "complaints" }),
          }))}
        />
        <TextField
          select
          size="small"
          label={t("complaints.department")}
          value={f.departmentId}
          onChange={(e) => set({ departmentId: e.target.value })}
          sx={{ minWidth: 180 }}
          SelectProps={{ displayEmpty: true }}
        >
          <MenuItem value="">{t("complaints.anyDept")}</MenuItem>
          {(meta.data?.departments ?? []).map((d) => (
            <MenuItem key={d.id} value={d.id}>
              {localized(d.name)}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label={t("complaints.village")}
          value={f.villageId}
          onChange={(e) => set({ villageId: e.target.value })}
          sx={{ minWidth: 160 }}
          SelectProps={{ displayEmpty: true }}
        >
          <MenuItem value="">{t("complaints.anyVillage")}</MenuItem>
          {(meta.data?.villages ?? []).map((v) => (
            <MenuItem key={v.id} value={v.id}>
              {localized(v.name)}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          size="small"
          type="date"
          label={t("complaints.from")}
          value={f.from}
          onChange={(e) => set({ from: e.target.value })}
        />
        <TextField
          size="small"
          type="date"
          label={t("complaints.to")}
          value={f.to}
          onChange={(e) => set({ to: e.target.value })}
        />
        {filtered && (
          <Button startIcon={<FilterAltOffRounded />} onClick={reset}>
            {t("common.reset")}
          </Button>
        )}
      </Stack>

      {q.isLoading && <ListSkeleton rows={5} />}
      {q.isError && <ErrorCard network={apiError(q.error).network} onRetry={() => q.refetch()} />}
      {q.isSuccess && (
        <Typography color="text.secondary" aria-live="polite">
          {t("complaints.total", { count: q.data.total })}
        </Typography>
      )}
      {q.isSuccess && items.length === 0 && (
        <Stack spacing={1} alignItems="flex-start">
          <Typography>{filtered ? t("complaints.empty") : t("complaints.none")}</Typography>
          {filtered && <Button onClick={reset}>{t("common.reset")}</Button>}
        </Stack>
      )}

      {items.length > 0 && desktop && (
        <TableContainer
          sx={{
            bgcolor: "background.paper",
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 2,
          }}
        >
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t("complaints.cols.number")}</TableCell>
                <TableCell>{t("complaints.cols.photo")}</TableCell>
                <TableCell>{t("complaints.cols.category")}</TableCell>
                <TableCell>{t("complaints.cols.place")}</TableCell>
                <TableCell>{t("complaints.cols.department")}</TableCell>
                <TableCell>{t("complaints.cols.status")}</TableCell>
                <TableCell>{sortHeader(SORTABLE.created, t("complaints.cols.created"))}</TableCell>
                <TableCell>{sortHeader(SORTABLE.age, t("complaints.cols.age"))}</TableCell>
                <TableCell>{sortHeader(SORTABLE.updated, t("complaints.cols.updated"))}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((c) => (
                <TableRow
                  key={c.id}
                  hover
                  onClick={() => open(c.id)}
                  onKeyDown={(e) => e.key === "Enter" && open(c.id)}
                  tabIndex={0}
                  sx={{ cursor: "pointer" }}
                >
                  <TableCell sx={{ whiteSpace: "nowrap", fontWeight: 500 }}>
                    {c.complaintNo}
                    <MeTooBadge count={c.supporterCount} />
                  </TableCell>
                  <TableCell>
                    {c.imageUrl ? (
                      <Box
                        component="img"
                        src={c.imageUrl}
                        alt=""
                        loading="lazy"
                        sx={{ width: 48, height: 48, objectFit: "cover", borderRadius: 1 }}
                      />
                    ) : (
                      <CategoryIcon category={c.category} color="primary" />
                    )}
                  </TableCell>
                  <TableCell>
                    {t(`categories.${c.category}`, { ns: "complaints" })}{" "}
                    {c.aiAccepted && (
                      <Chip
                        size="small"
                        label={t("complaints.ai")}
                        color="secondary"
                        sx={{ height: 20 }}
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    {[localized(c.village), c.landmark].filter(Boolean).join(" · ")}
                  </TableCell>
                  <TableCell>{localized(c.department)}</TableCell>
                  <TableCell>
                    <StatusChip status={c.status} size="small" />
                  </TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{formatDateTime(c.createdAt)}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={t("common.days", { n: c.ageDays })}
                      color={
                        c.ageDays > 7 && !["RESOLVED", "REJECTED"].includes(c.status)
                          ? "error"
                          : "default"
                      }
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{timeAgo(c.updatedAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      {items.length > 0 && !desktop && (
        <Stack spacing={1.5}>
          {items.map((c) => (
            <ButtonBase
              key={c.id}
              onClick={() => open(c.id)}
              sx={{
                display: "block",
                textAlign: "left",
                p: 1.5,
                borderRadius: 2,
                border: "1px solid",
                borderColor: "divider",
                bgcolor: "background.paper",
              }}
            >
              <Stack direction="row" justifyContent="space-between" spacing={1}>
                <Typography sx={{ fontWeight: 700 }}>
                  {c.complaintNo}
                  <MeTooBadge count={c.supporterCount} />
                </Typography>
                <StatusChip status={c.status} size="small" />
              </Stack>
              <Typography>{t(`categories.${c.category}`, { ns: "complaints" })}</Typography>
              <Typography variant="body2" color="text.secondary">
                {[localized(c.village), c.landmark, t("common.days", { n: c.ageDays })]
                  .filter(Boolean)
                  .join(" · ")}
              </Typography>
            </ButtonBase>
          ))}
        </Stack>
      )}
      {q.isSuccess && q.data.total > 0 && (
        <TablePagination
          component="div"
          count={q.data.total}
          page={f.page - 1}
          onPageChange={(_e, p) => set({ page: p + 1 })}
          rowsPerPage={f.limit}
          rowsPerPageOptions={LIMITS}
          onRowsPerPageChange={(e) => set({ limit: Number(e.target.value) })}
          labelRowsPerPage={t("common.rowsPerPage")}
        />
      )}
    </Stack>
  );
}
