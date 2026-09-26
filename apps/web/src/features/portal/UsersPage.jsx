import { useState } from "react";
import {
  Button,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { AddRounded, ContentCopyRounded, MoreVertRounded } from "@mui/icons-material";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiError } from "../../api/client.js";
import { adminApi } from "../../api/endpoints.js";
import { copyText } from "../../lib/device.js";
import { useLocalized } from "../../lib/localized.js";
import { toTenDigits } from "../../lib/phone.js";
import { formatDate, timeAgo } from "../../lib/time.js";
import { useSession } from "../../stores/session.js";
import { toast } from "../../stores/toast.js";
import { PageTitle } from "../../components/ui/PageTitle.jsx";
import { ConfirmDialog, ResponsiveDialog } from "../../components/ui/ResponsiveDialog.jsx";
import { ErrorCard, ListSkeleton } from "../../components/ui/States.jsx";
import { PhoneField, SubmitButton } from "../../components/ui/fields.jsx";

const ROLES = ["citizen", "authority", "admin"];

function OnceDialog({ open, title, body, value, onClose }) {
  const { t } = useTranslation("portal");
  return (
    <ResponsiveDialog
      open={open}
      onClose={onClose}
      title={title}
      labelId="once-title"
      actions={
        <Button variant="contained" onClick={onClose}>
          {t("actions.close", { ns: "common" })}
        </Button>
      }
    >
      <Stack spacing={2}>
        <Typography>{body}</Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography
            sx={{ fontFamily: "monospace", fontSize: "1.5rem", fontWeight: 700, letterSpacing: 1 }}
          >
            {value}
          </Typography>
          <IconButton
            aria-label={t("common.copy")}
            onClick={async () => (await copyText(value)) && toast(t("common.copied"))}
          >
            <ContentCopyRounded />
          </IconButton>
        </Stack>
      </Stack>
    </ResponsiveDialog>
  );
}

/** Create / edit form for staff accounts (docs/03 A-07). */
function UserForm({ user, onClose, onCreated }) {
  const { t } = useTranslation("portal");
  const localized = useLocalized();
  const qc = useQueryClient();
  const jurs = useQuery({ queryKey: ["admin", "jurisdictions"], queryFn: adminApi.jurisdictions });
  const depts = useQuery({ queryKey: ["admin", "departments"], queryFn: adminApi.departments });
  const [v, setV] = useState({
    name: user?.name ?? "",
    phone: "",
    email: user?.email ?? "",
    role: user?.role === "admin" ? "admin" : "authority",
    title: user?.title ?? "",
    jurisdictionIds: user?.jurisdictions?.map((j) => j.id) ?? [],
    departmentId: user?.department?.id ?? "",
  });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setV((x) => ({ ...x, [k]: e.target ? e.target.value : e }));
  const areas = jurs.data ?? [];

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      if (user) {
        const body = { role: v.role };
        if (v.role === "authority")
          Object.assign(body, {
            jurisdictionIds: v.jurisdictionIds,
            departmentId: v.departmentId || null,
            title: v.title || null,
          });
        await adminApi.updateUser(user.id, body);
        toast(t("common.updated"));
        onClose();
      } else {
        const ten = toTenDigits(v.phone);
        const res = await adminApi.createUser({
          name: v.name,
          phone: ten ? `+91${ten}` : v.phone,
          email: v.email || null,
          role: v.role,
          ...(v.role === "authority"
            ? {
                jurisdictionIds: v.jurisdictionIds,
                departmentId: v.departmentId || null,
                title: v.title || undefined,
              }
            : {}),
        });
        onCreated(res);
      }
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    } catch (err) {
      const e = apiError(err);
      setError(
        e.details?.length
          ? `${e.message} (${e.details.map((d) => d.field).join(", ")})`
          : e.message,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <ResponsiveDialog
      open
      onClose={busy ? undefined : onClose}
      title={user ? t("users.form.editTitle", { name: user.name }) : t("users.form.createTitle")}
      labelId="user-form-title"
      actions={
        <>
          <Button variant="outlined" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <SubmitButton type="button" busy={busy} onClick={submit}>
            {user ? t("common.save") : t("users.form.create")}
          </SubmitButton>
        </>
      }
    >
      <Stack spacing={2.5} sx={{ pt: 1 }}>
        {!user && (
          <>
            <TextField
              label={t("users.form.name")}
              value={v.name}
              onChange={set("name")}
              fullWidth
            />
            <PhoneField
              label={t("users.form.phone")}
              value={v.phone}
              onChange={(val) => setV((x) => ({ ...x, phone: val }))}
            />
            <TextField
              label={t("users.form.email")}
              type="email"
              value={v.email}
              onChange={set("email")}
              fullWidth
            />
          </>
        )}
        <TextField
          select
          label={t("users.form.role")}
          value={v.role}
          onChange={set("role")}
          fullWidth
        >
          <MenuItem value="authority">{t("roles.authority")}</MenuItem>
          <MenuItem value="admin">{t("roles.admin")}</MenuItem>
        </TextField>
        {v.role === "authority" && (
          <>
            <TextField
              label={t("users.form.title")}
              value={v.title}
              onChange={set("title")}
              fullWidth
            />
            <TextField
              select
              label={t("users.form.jurisdictions")}
              value={v.jurisdictionIds}
              onChange={(e) => setV((x) => ({ ...x, jurisdictionIds: e.target.value }))}
              SelectProps={{
                multiple: true,
                renderValue: (ids) =>
                  ids.map((id) => localized(areas.find((j) => j.id === id)?.name)).join(", "),
              }}
              fullWidth
            >
              {areas.map((j) => (
                <MenuItem key={j.id} value={j.id}>
                  {localized(j.name)} ({j.type})
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label={t("users.form.department")}
              value={v.departmentId}
              onChange={set("departmentId")}
              SelectProps={{ displayEmpty: true }}
              fullWidth
            >
              <MenuItem value="">{t("users.allDepts")}</MenuItem>
              {(depts.data?.items ?? []).map((d) => (
                <MenuItem key={d.id} value={d.id}>
                  {localized(d.name)}
                </MenuItem>
              ))}
            </TextField>
          </>
        )}
        {error && (
          <Typography color="error" role="alert">
            {error}
          </Typography>
        )}
      </Stack>
    </ResponsiveDialog>
  );
}

/** A-07 Users & authority accounts (docs/03). Admin only. */
export default function UsersPage() {
  const { t } = useTranslation("portal");
  const localized = useLocalized();
  const qc = useQueryClient();
  const me = useSession((s) => s.user);
  const [role, setRole] = useState("authority");
  const [search, setSearch] = useState("");
  const [menu, setMenu] = useState(null); // { anchor, user }
  const [form, setForm] = useState(null); // "new" | user
  const [confirm, setConfirm] = useState(null);
  const [once, setOnce] = useState(null);
  const [busy, setBusy] = useState(false);
  const q = useQuery({
    queryKey: ["admin", "users", role, search],
    queryFn: () => adminApi.users({ role, ...(search.trim() ? { q: search.trim() } : {}) }),
    placeholderData: (p) => p,
  });

  const toggleStatus = async () => {
    const u = confirm;
    setBusy(true);
    try {
      await adminApi.updateUser(u.id, { status: u.status === "active" ? "inactive" : "active" });
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      toast(t("common.updated"));
    } catch (err) {
      toast(apiError(err).message, "error");
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const resetCode = async (u) => {
    setMenu(null);
    try {
      const { code } = await adminApi.resetCode(u.id);
      setOnce({ title: t("users.codeTitle"), body: t("users.codeBody"), value: code });
    } catch (err) {
      toast(apiError(err).message, "error");
    }
  };

  const items = q.data?.items ?? [];
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
        <PageTitle sx={{ mb: 0 }}>{t("users.title")}</PageTitle>
        <Button variant="contained" startIcon={<AddRounded />} onClick={() => setForm("new")}>
          {t("users.create")}
        </Button>
      </Stack>
      <Tabs value={role} onChange={(_e, v) => setRole(v)}>
        {ROLES.map((r) => (
          <Tab key={r} value={r} label={t(`users.tabs.${r}`)} />
        ))}
      </Tabs>
      <TextField
        size="small"
        label={t("users.search")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        sx={{ maxWidth: 360 }}
      />
      {q.isLoading && <ListSkeleton />}
      {q.isError && <ErrorCard network={apiError(q.error).network} onRetry={() => q.refetch()} />}
      {q.isSuccess && items.length === 0 && (
        <Typography color="text.secondary">{t("users.empty")}</Typography>
      )}
      {items.length > 0 && (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                {["name", "phone", "area", "department", "status", "created", "lastLogin"].map(
                  (c) => (
                    <TableCell key={c}>{t(`users.cols.${c}`)}</TableCell>
                  ),
                )}
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <Typography sx={{ fontWeight: 500 }}>{u.name}</Typography>
                    {u.title && (
                      <Typography variant="body2" color="text.secondary">
                        {u.title}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ fontFamily: "monospace", whiteSpace: "nowrap" }}>
                    {u.maskedPhone ?? "—"}
                  </TableCell>
                  <TableCell>
                    {u.role === "authority"
                      ? u.jurisdictions.map((j) => localized(j.name)).join(", ")
                      : localized(u.village)}
                  </TableCell>
                  <TableCell>
                    {u.role === "authority"
                      ? u.department
                        ? localized(u.department.name)
                        : t("users.allDepts")
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={t(`common.${u.status === "active" ? "active" : "inactive"}`)}
                      color={u.status === "active" ? "success" : "default"}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{formatDate(u.createdAt)}</TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>
                    {u.lastLoginAt ? timeAgo(u.lastLoginAt) : t("users.never")}
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      aria-label={t("users.menu", { name: u.name })}
                      onClick={(e) => setMenu({ anchor: e.currentTarget, user: u })}
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
        {menu?.user.role !== "citizen" && menu?.user.id !== me?.id && (
          <MenuItem
            onClick={() => {
              setForm(menu.user);
              setMenu(null);
            }}
          >
            {t("users.edit")}
          </MenuItem>
        )}
        {menu?.user.id !== me?.id && (
          <MenuItem
            onClick={() => {
              setConfirm(menu.user);
              setMenu(null);
            }}
          >
            {t(menu?.user.status === "active" ? "users.deactivate" : "users.reactivate")}
          </MenuItem>
        )}
        {menu && <MenuItem onClick={() => resetCode(menu.user)}>{t("users.resetCode")}</MenuItem>}
      </Menu>
      {form && (
        <UserForm
          user={form === "new" ? null : form}
          onClose={() => setForm(null)}
          onCreated={(res) => {
            setForm(null);
            setOnce({
              title: t("users.tempTitle"),
              body: t("users.tempBody", { name: res.user.name }),
              value: res.tempPassword,
            });
          }}
        />
      )}
      <ConfirmDialog
        open={Boolean(confirm)}
        title={
          confirm
            ? t(confirm.status === "active" ? "users.deactivateTitle" : "users.reactivateTitle", {
                name: confirm.name,
              })
            : ""
        }
        body={
          confirm
            ? t(confirm.status === "active" ? "users.deactivateBody" : "users.reactivateBody")
            : ""
        }
        confirmLabel={
          confirm ? t(confirm.status === "active" ? "users.deactivate" : "users.reactivate") : ""
        }
        cancelLabel={t("common.cancel")}
        busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={toggleStatus}
      />
      <OnceDialog open={Boolean(once)} {...(once ?? {})} onClose={() => setOnce(null)} />
    </Stack>
  );
}
