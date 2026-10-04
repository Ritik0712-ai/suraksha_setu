import { useState } from "react";
import {
  Box,
  Button,
  Checkbox,
  Divider,
  FormControlLabel,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import {
  AssignmentRounded,
  BloodtypeRounded,
  ChevronRightRounded,
  ContactPhoneRounded,
  DeleteForeverRounded,
  DevicesRounded,
  HistoryRounded,
  InfoRounded,
  LockRounded,
  LogoutRounded,
  PrivacyTipRounded,
  VolunteerActivismRounded,
} from "@mui/icons-material";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { apiError } from "../../api/client.js";
import { usersApi } from "../../api/endpoints.js";
import { maskPhone } from "../../lib/phone.js";
import { usePrefs } from "../../stores/prefs.js";
import { useSession } from "../../stores/session.js";
import { toast } from "../../stores/toast.js";
import { SahayakIcon } from "../../components/icons/index.jsx";
import { Notice } from "../../components/ui/Notice.jsx";
import { PageTitle } from "../../components/ui/PageTitle.jsx";
import { ConfirmDialog, ResponsiveDialog } from "../../components/ui/ResponsiveDialog.jsx";
import { PasswordField, SubmitButton } from "../../components/ui/fields.jsx";
import { useFieldError } from "../../components/ui/useFieldError.js";
import {
  applyServerErrors,
  changePasswordSchema,
  nameRule,
  optionalEmail,
} from "../auth/schemas.js";
import { clearClientSession } from "../auth/session.js";
import { useLogout } from "../auth/useLogout.js";
import { SosHistoryDialog } from "../sos/SosHistoryDialog.jsx";
import { useVillages } from "../auth/useVillages.js";
import { VillageAutocomplete } from "../auth/VillageAutocomplete.jsx";
import { forgetAccount } from "../../lib/knownAccounts.js";

const APP_VERSION = "0.3.0";

function Section({ title, children }) {
  return (
    <Paper variant="outlined" component="section" sx={{ borderRadius: 2, overflow: "hidden" }}>
      <Typography variant="h3" component="h2" sx={{ px: 2, pt: 2, pb: 1 }}>
        {title}
      </Typography>
      {children}
    </Paper>
  );
}

function Row({ icon: Icon, primary, secondary, to, onClick, danger }) {
  // Inside an <li>: a <ul> may only hold list items (WCAG 1.3.1, axe "list").
  return (
    <ListItem disablePadding>
      <ListItemButton
        component={to ? RouterLink : "button"}
        to={to}
        onClick={onClick}
        sx={{
          minHeight: 56,
          width: "100%",
          textAlign: "left",
          color: danger ? "error.main" : undefined,
        }}
      >
        <ListItemIcon sx={{ color: danger ? "error.main" : "primary.main" }}>
          <Icon />
        </ListItemIcon>
        <ListItemText primary={primary} secondary={secondary} />
        {to && <ChevronRightRounded color="action" />}
      </ListItemButton>
    </ListItem>
  );
}

const profileSchema = z
  .object({
    name: nameRule,
    email: optionalEmail,
    village: z.object({ id: z.string(), label: z.string() }).nullable(),
    notListed: z.boolean(),
    villageOther: z.string().trim().max(80, "too_long"),
  })
  .superRefine((v, ctx) => {
    if (v.notListed && v.villageOther.length < 2)
      ctx.addIssue({ code: "custom", path: ["villageOther"], message: "required" });
    if (!v.notListed && !v.village)
      ctx.addIssue({ code: "custom", path: ["village"], message: "village_required" });
  });

/** Header card with inline edit: name, village, email (docs/03 S-27). */
function ProfileCard({ user, villageName }) {
  const { t } = useTranslation("profile");
  const fieldError = useFieldError();
  const setUser = useSession((s) => s.setUser);
  const [editing, setEditing] = useState(false);
  const {
    control,
    register,
    handleSubmit,
    watch,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(profileSchema) });
  const notListed = watch("notListed");

  const startEdit = () => {
    reset({
      name: user.name,
      email: user.email ?? "",
      village: user.villageOther ? null : { id: user.jurisdictionId, label: villageName ?? "" },
      notListed: Boolean(user.villageOther),
      villageOther: user.villageOther ?? "",
    });
    setEditing(true);
  };

  const onSubmit = async (v) => {
    const body = { name: v.name, email: v.email || null };
    if (v.notListed) {
      if (v.villageOther !== user.villageOther) body.villageOther = v.villageOther;
    } else if (v.village.id !== user.jurisdictionId || user.villageOther) {
      body.jurisdictionId = v.village.id;
    }
    try {
      setUser(await usersApi.update(body));
      setEditing(false);
      toast(t("updated"));
    } catch (err) {
      const e = apiError(err);
      if (!applyServerErrors(e, setError, { jurisdictionId: "village" }))
        setError("root", {
          message: e.network ? t("states.networkError", { ns: "common" }) : e.message,
        });
    }
  };

  if (!editing) {
    return (
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
        <Stack direction="row" alignItems="flex-start" spacing={2}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h2" component="p">
              {user.name}
            </Typography>
            <Typography sx={{ mt: 0.5 }}>{maskPhone(user.phone)}</Typography>
            <Typography color="text.secondary">{user.villageOther || villageName}</Typography>
            {user.email && <Typography color="text.secondary">{user.email}</Typography>}
          </Box>
          <Button variant="outlined" onClick={startEdit}>
            {t("actions.edit", { ns: "common" })}
          </Button>
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
      <Stack component="form" noValidate spacing={2.5} onSubmit={handleSubmit(onSubmit)}>
        <TextField
          {...register("name")}
          id="profile-name"
          label={t("name")}
          fullWidth
          error={Boolean(errors.name)}
          helperText={fieldError(errors.name)}
        />
        {!notListed && (
          <Controller
            name="village"
            control={control}
            render={({ field }) => (
              <VillageAutocomplete
                id="profile-village"
                value={field.value}
                onChange={field.onChange}
                error={Boolean(errors.village)}
                helperText={fieldError(errors.village)}
              />
            )}
          />
        )}
        <Controller
          name="notListed"
          control={control}
          render={({ field }) => (
            <FormControlLabel
              control={
                <Checkbox
                  checked={Boolean(field.value)}
                  onChange={(e) => field.onChange(e.target.checked)}
                />
              }
              label={t("register.notListed", { ns: "auth" })}
            />
          )}
        />
        {notListed && (
          <TextField
            {...register("villageOther")}
            id="profile-village-other"
            label={t("register.villageOther", { ns: "auth" })}
            fullWidth
            error={Boolean(errors.villageOther)}
            helperText={fieldError(errors.villageOther)}
          />
        )}
        <TextField
          {...register("email")}
          id="profile-email"
          type="email"
          autoComplete="email"
          label={t("email")}
          fullWidth
          error={Boolean(errors.email)}
          helperText={fieldError(errors.email) ?? t("emailHelp")}
        />
        {errors.root && <Notice kind="error">{errors.root.message}</Notice>}
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={() => setEditing(false)} sx={{ flex: 1 }}>
            {t("actions.cancel", { ns: "common" })}
          </Button>
          <SubmitButton busy={isSubmitting} sx={{ flex: 1 }}>
            {t("actions.save", { ns: "common" })}
          </SubmitButton>
        </Stack>
      </Stack>
    </Paper>
  );
}

export function ChangePasswordDialog({ open, onClose }) {
  const { t } = useTranslation("profile");
  const fieldError = useFieldError();
  const setSession = useSession((s) => s.setSession);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirm: "" },
  });
  const close = () => {
    reset();
    onClose();
  };
  const onSubmit = async (v) => {
    try {
      setSession(
        await usersApi.changePassword({
          currentPassword: v.currentPassword,
          newPassword: v.newPassword,
        }),
      );
      toast(t("passwordChanged"));
      close();
    } catch (err) {
      const e = apiError(err);
      if (!applyServerErrors(e, setError)) setError("root", { message: e.message });
    }
  };
  return (
    <ResponsiveDialog
      open={open}
      onClose={close}
      title={t("changePassword")}
      labelId="change-password-title"
    >
      <Stack component="form" noValidate spacing={2.5} onSubmit={handleSubmit(onSubmit)}>
        <PasswordField
          {...register("currentPassword")}
          id="cp-current"
          label={t("currentPassword")}
          autoComplete="current-password"
          error={Boolean(errors.currentPassword)}
          helperText={fieldError(errors.currentPassword)}
        />
        <PasswordField
          {...register("newPassword")}
          id="cp-new"
          label={t("newPassword")}
          autoComplete="new-password"
          error={Boolean(errors.newPassword)}
          helperText={fieldError(errors.newPassword) ?? t("register.passwordHint", { ns: "auth" })}
        />
        <PasswordField
          {...register("confirm")}
          id="cp-confirm"
          label={t("confirmPassword")}
          autoComplete="new-password"
          error={Boolean(errors.confirm)}
          helperText={fieldError(errors.confirm)}
        />
        {errors.root && <Notice kind="error">{errors.root.message}</Notice>}
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={close} sx={{ flex: 1 }}>
            {t("actions.cancel", { ns: "common" })}
          </Button>
          <SubmitButton busy={isSubmitting} sx={{ flex: 1 }}>
            {t("actions.save", { ns: "common" })}
          </SubmitButton>
        </Stack>
      </Stack>
    </ResponsiveDialog>
  );
}

function DeleteAccountDialog({ open, onClose }) {
  const { t } = useTranslation("profile");
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const close = () => {
    setPassword("");
    setError(null);
    onClose();
  };
  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await usersApi.remove({ password });
      forgetAccount(useSession.getState().user?.phone);
      clearClientSession({ endedByUser: true });
      navigate("/", { replace: true });
      toast(t("deleted"));
    } catch (err) {
      const e = apiError(err);
      setError(
        e.details?.[0]?.field === "password" ? t("errors.incorrect", { ns: "common" }) : e.message,
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <ConfirmDialog
      open={open}
      title={t("deleteAccount")}
      body={t("deleteBody")}
      confirmLabel={t("deleteConfirm")}
      cancelLabel={t("actions.cancel", { ns: "common" })}
      onConfirm={confirm}
      onCancel={close}
      busy={busy}
      confirmDisabled={!password}
    >
      <PasswordField
        id="delete-password"
        label={t("deletePassword")}
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={Boolean(error)}
        helperText={error}
      />
    </ConfirmDialog>
  );
}

/** S-27 Profile & settings (docs/03). SOS history is added with the SOS module (task 4A). */
export default function ProfilePage() {
  const { t, i18n } = useTranslation("profile");
  const user = useSession((s) => s.user);
  const villages = useVillages();
  const setLanguage = usePrefs((s) => s.setLanguage);
  const textSize = usePrefs((s) => s.textSize);
  const setTextSize = usePrefs((s) => s.setTextSize);
  const logout = useLogout();
  const logoutAll = useLogout({ all: true });
  const [dialog, setDialog] = useState(null);
  const lang = i18n.resolvedLanguage === "en" ? "en" : "hi";
  const villageName = villages.data?.find((v) => v.id === user?.jurisdictionId)?.name[lang];

  if (!user) return null;

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
    setLanguage(lng);
    usersApi.update({ language: lng }).catch(() => {});
  };
  const changeSize = (size) => {
    setTextSize(size);
    usersApi.update({ textSize: size }).catch(() => {});
  };

  return (
    <Stack spacing={2.5} sx={{ maxWidth: 760 }}>
      <PageTitle>{t("title")}</PageTitle>
      <ProfileCard user={user} villageName={villageName} />

      <Section title={t("safety")}>
        <List disablePadding>
          <Row
            icon={ContactPhoneRounded}
            primary={t("contacts")}
            secondary={t("contactsCount", { count: user.emergencyContactCount })}
            to="/profile/contacts"
          />
          <Row
            icon={HistoryRounded}
            primary={t("history.title", { ns: "sos" })}
            onClick={() => setDialog("sosHistory")}
          />
        </List>
      </Section>

      <Section title={t("activity")}>
        <List disablePadding>
          <Row
            icon={AssignmentRounded}
            primary={t("modules.myComplaints", { ns: "common" })}
            to="/complaints"
          />
          <Row icon={VolunteerActivismRounded} primary={t("mySchemes")} to="/my-schemes" />
          <Row icon={BloodtypeRounded} primary={t("donor")} to="/blood/donor" />
          <Row icon={SahayakIcon} primary={t("sahayakChats")} to="/sahayak" />
        </List>
      </Section>

      <Section title={t("settings")}>
        <Stack spacing={2} sx={{ px: 2, pb: 2 }}>
          <Box>
            <Typography id="lang-label" sx={{ mb: 1, fontWeight: 500 }}>
              {t("language")}
            </Typography>
            <ToggleButtonGroup
              exclusive
              value={lang}
              aria-labelledby="lang-label"
              onChange={(_e, v) => v && changeLanguage(v)}
            >
              <ToggleButton value="hi" lang="hi" sx={{ minHeight: 48, px: 3 }}>
                हिन्दी
              </ToggleButton>
              <ToggleButton value="en" lang="en" sx={{ minHeight: 48, px: 3 }}>
                English
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
          <Box>
            <Typography id="size-label" sx={{ mb: 1, fontWeight: 500 }}>
              {t("textSize")}
            </Typography>
            <ToggleButtonGroup
              exclusive
              value={textSize}
              aria-labelledby="size-label"
              onChange={(_e, v) => v && changeSize(v)}
            >
              {[
                ["sm", "A−", "header.sizeSm"],
                ["md", "A", "header.sizeMd"],
                ["lg", "A+", "header.sizeLg"],
              ].map(([v, label, key]) => (
                <ToggleButton
                  key={v}
                  value={v}
                  aria-label={t(key, { ns: "common" })}
                  sx={{ minHeight: 48, minWidth: 56, fontWeight: 700 }}
                >
                  {label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>
        </Stack>
        <Divider />
        <List disablePadding>
          <Row
            icon={LockRounded}
            primary={t("changePassword")}
            onClick={() => setDialog("password")}
          />
        </List>
      </Section>

      <Section title={t("about")}>
        <List disablePadding>
          <Row icon={InfoRounded} primary={t("aboutLink")} to="/about" />
          <Row icon={PrivacyTipRounded} primary={t("privacyLink")} to="/privacy" />
        </List>
        <Typography variant="body2" color="text.secondary" sx={{ px: 2, pb: 2 }}>
          {t("version", { version: APP_VERSION })}
        </Typography>
      </Section>

      <Section title={t("account")}>
        <List disablePadding>
          <Row icon={LogoutRounded} primary={t("logout")} onClick={logout} />
          <Row
            icon={DevicesRounded}
            primary={t("logoutAll")}
            onClick={() => setDialog("logoutAll")}
          />
          <Row
            icon={DeleteForeverRounded}
            primary={t("deleteAccount")}
            onClick={() => setDialog("delete")}
            danger
          />
        </List>
      </Section>

      <ChangePasswordDialog open={dialog === "password"} onClose={() => setDialog(null)} />
      <ConfirmDialog
        open={dialog === "logoutAll"}
        title={t("logoutAll")}
        body={t("logoutAllBody")}
        confirmLabel={t("logoutAll")}
        cancelLabel={t("actions.cancel", { ns: "common" })}
        onConfirm={logoutAll}
        onCancel={() => setDialog(null)}
      />
      <DeleteAccountDialog open={dialog === "delete"} onClose={() => setDialog(null)} />
      <SosHistoryDialog open={dialog === "sosHistory"} onClose={() => setDialog(null)} />
    </Stack>
  );
}
