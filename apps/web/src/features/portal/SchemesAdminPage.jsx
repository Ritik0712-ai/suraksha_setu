import { useState } from "react";
import {
  Button,
  Chip,
  FormControlLabel,
  IconButton,
  Menu,
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
import { AddRounded, MoreVertRounded } from "@mui/icons-material";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import C from "../../config/constants.js";
import { apiError } from "../../api/client.js";
import { adminApi } from "../../api/endpoints.js";
import { useLocalized } from "../../lib/localized.js";
import { formatDate, timeAgo } from "../../lib/time.js";
import { toast } from "../../stores/toast.js";
import { PageTitle } from "../../components/ui/PageTitle.jsx";
import { ConfirmDialog } from "../../components/ui/ResponsiveDialog.jsx";
import { ErrorCard, ListSkeleton } from "../../components/ui/States.jsx";

/** A-08 Scheme manager (docs/03). Admin only. */
export default function SchemesAdminPage() {
  const { t } = useTranslation("portal");
  const localized = useLocalized();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [stale, setStale] = useState(false);
  const [menu, setMenu] = useState(null);
  const [del, setDel] = useState(null);
  const params = {
    ...(status ? { status } : {}),
    ...(category ? { category } : {}),
    ...(stale ? { needsVerification: 1 } : {}),
  };
  const q = useQuery({
    queryKey: ["admin", "schemes", params],
    queryFn: () => adminApi.schemes(params),
  });

  const action = async (s, name) => {
    setMenu(null);
    try {
      if (name === "delete") await adminApi.deleteScheme(s.id);
      else await adminApi.schemeAction(s.id, name);
      qc.invalidateQueries({ queryKey: ["admin", "schemes"] });
      toast(t("common.updated"));
    } catch (err) {
      toast(apiError(err).message, "error");
    }
  };

  const items = q.data ?? [];
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
        <PageTitle sx={{ mb: 0 }}>{t("schemesAdmin.title")}</PageTitle>
        <Button
          variant="contained"
          startIcon={<AddRounded />}
          component={RouterLink}
          to="/portal/admin/schemes/new"
        >
          {t("schemesAdmin.new")}
        </Button>
      </Stack>
      <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap alignItems="center">
        <TextField
          select
          size="small"
          label={t("schemesAdmin.cols.status")}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          sx={{ minWidth: 160 }}
          SelectProps={{ displayEmpty: true }}
        >
          <MenuItem value="">{t("schemesAdmin.anyStatus")}</MenuItem>
          {C.schemeStatus.map((s) => (
            <MenuItem key={s} value={s}>
              {t(`schemesAdmin.status.${s}`)}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label={t("schemesAdmin.cols.category")}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          sx={{ minWidth: 180 }}
          SelectProps={{ displayEmpty: true }}
        >
          <MenuItem value="">{t("schemesAdmin.anyCategory")}</MenuItem>
          {C.schemeCategories.map((c) => (
            <MenuItem key={c} value={c}>
              {t(`categories.${c}`, { ns: "schemes" })}
            </MenuItem>
          ))}
        </TextField>
        <FormControlLabel
          control={<Switch checked={stale} onChange={(e) => setStale(e.target.checked)} />}
          label={t("schemesAdmin.needsVerification")}
        />
      </Stack>
      {q.isLoading && <ListSkeleton />}
      {q.isError && <ErrorCard network={apiError(q.error).network} onRetry={() => q.refetch()} />}
      {q.isSuccess && items.length === 0 && (
        <Typography color="text.secondary">{t("schemesAdmin.empty")}</Typography>
      )}
      {items.length > 0 && (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                {["name", "category", "level", "status", "verified", "updated"].map((c) => (
                  <TableCell key={c}>{t(`schemesAdmin.cols.${c}`)}</TableCell>
                ))}
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((s) => (
                <TableRow
                  key={s.id}
                  hover
                  sx={{ cursor: "pointer" }}
                  onClick={() => navigate(`/portal/admin/schemes/${s.id}`)}
                >
                  <TableCell>
                    <Typography sx={{ fontWeight: 500 }}>{s.name.hi}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {s.name.en}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {s.categories.map((c) => t(`categories.${c}`, { ns: "schemes" })).join(", ")}
                  </TableCell>
                  <TableCell>{t(`level.${s.level}`, { ns: "schemes" })}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={t(`schemesAdmin.status.${s.status}`)}
                      color={s.status === "published" ? "success" : "default"}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell
                    sx={{ color: s.stale ? "error.main" : "inherit", whiteSpace: "nowrap" }}
                  >
                    {s.lastVerifiedAt
                      ? formatDate(s.lastVerifiedAt)
                      : t("schemesAdmin.notVerified")}
                  </TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{timeAgo(s.updatedAt)}</TableCell>
                  <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                    <IconButton
                      aria-label={t("schemesAdmin.menu", { name: localized(s.name) })}
                      onClick={(e) => setMenu({ anchor: e.currentTarget, s })}
                    >
                      <MoreVertRounded />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      <Menu anchorEl={menu?.anchor} open={Boolean(menu)} onClose={() => setMenu(null)}>
        {menu && menu.s.status === "draft" && (
          <MenuItem onClick={() => action(menu.s, "publish")} disabled={!menu.s.lastVerifiedAt}>
            {t("schemesAdmin.publish")}
          </MenuItem>
        )}
        {menu && menu.s.status === "published" && (
          <MenuItem onClick={() => action(menu.s, "unpublish")}>
            {t("schemesAdmin.unpublish")}
          </MenuItem>
        )}
        {menu && (
          <MenuItem onClick={() => action(menu.s, "verify")}>{t("schemesAdmin.verify")}</MenuItem>
        )}
        {menu && (
          <MenuItem onClick={() => action(menu.s, "duplicate")}>
            {t("schemesAdmin.duplicate")}
          </MenuItem>
        )}
        {menu && menu.s.status === "draft" && (
          <MenuItem
            onClick={() => {
              setDel(menu.s);
              setMenu(null);
            }}
            sx={{ color: "error.main" }}
          >
            {t("schemesAdmin.delete")}
          </MenuItem>
        )}
      </Menu>
      <ConfirmDialog
        open={Boolean(del)}
        title={t("schemesAdmin.deleteTitle")}
        body={t("schemesAdmin.deleteBody")}
        confirmLabel={t("schemesAdmin.delete")}
        cancelLabel={t("common.cancel")}
        onCancel={() => setDel(null)}
        onConfirm={async () => {
          await action(del, "delete");
          setDel(null);
        }}
      />
    </Stack>
  );
}
