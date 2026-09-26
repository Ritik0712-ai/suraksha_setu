import { useState } from "react";
import { Button, Stack, TextField, Typography } from "@mui/material";
import { KeyRounded, LogoutRounded } from "@mui/icons-material";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiError } from "../../api/client.js";
import { adminApi, usersApi } from "../../api/endpoints.js";
import { useLocalized } from "../../lib/localized.js";
import { maskPhone } from "../../lib/phone.js";
import { useSession } from "../../stores/session.js";
import { toast } from "../../stores/toast.js";
import { LanguageToggle } from "../../components/layout/HeaderControls.jsx";
import { PageTitle } from "../../components/ui/PageTitle.jsx";
import { SubmitButton } from "../../components/ui/fields.jsx";
import { reloadMe } from "../auth/session.js";
import { useLogout } from "../auth/useLogout.js";
import { ChangePasswordDialog } from "../profile/ProfilePage.jsx";
import { Section } from "./ui.jsx";

/** A-14 Portal profile (docs/03): name/email editable, the rest read-only. */
export default function PortalProfilePage() {
  const { t } = useTranslation("portal");
  const localized = useLocalized();
  const user = useSession((s) => s.user);
  const logoutAll = useLogout({ all: true });
  const overview = useQuery({ queryKey: ["admin", "overview"], queryFn: adminApi.overview });
  const meta = useQuery({ queryKey: ["admin", "meta"], queryFn: adminApi.meta });
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [busy, setBusy] = useState(false);
  const [pw, setPw] = useState(false);
  if (!user) return null;
  const dept = user.authority?.departmentId
    ? meta.data?.departments.find((d) => d.id === user.authority.departmentId)
    : null;

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await usersApi.update({ name: name.trim(), email: email.trim() || null });
      await reloadMe();
      toast(t("toast.saved", { ns: "common" }));
    } catch (err) {
      toast(apiError(err).message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack spacing={2} sx={{ maxWidth: 640 }}>
      <PageTitle sx={{ mb: 0 }}>{t("profile.title")}</PageTitle>
      <Section>
        <Stack spacing={1}>
          <Typography>
            <strong>{t("profile.role")}:</strong> {t(`roles.${user.role}`)}
          </Typography>
          <Typography>
            <strong>{t("profile.phone")}:</strong> {maskPhone(user.phone)}
          </Typography>
          {user.role === "authority" && (
            <>
              <Typography>
                <strong>{t("profile.areas")}:</strong>{" "}
                {(overview.data?.scope ?? []).map(localized).join(", ") || "—"}
              </Typography>
              <Typography>
                <strong>{t("profile.department")}:</strong>{" "}
                {dept ? localized(dept.name) : t("profile.allDepts")}
              </Typography>
            </>
          )}
        </Stack>
      </Section>
      <Section>
        <Stack component="form" spacing={2} onSubmit={save} noValidate>
          <TextField
            label={t("profile.name")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
          />
          <TextField
            label={t("profile.email")}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            fullWidth
          />
          <SubmitButton busy={busy}>{t("common.save")}</SubmitButton>
        </Stack>
      </Section>
      <Section>
        <Stack spacing={1.5} alignItems="flex-start">
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography sx={{ fontWeight: 500 }}>{t("profile.language")}:</Typography>
            <LanguageToggle />
          </Stack>
          <Button startIcon={<KeyRounded />} variant="outlined" onClick={() => setPw(true)}>
            {t("profile.changePassword")}
          </Button>
          <Button startIcon={<LogoutRounded />} color="error" onClick={logoutAll}>
            {t("profile.logoutAll")}
          </Button>
        </Stack>
      </Section>
      <ChangePasswordDialog open={pw} onClose={() => setPw(false)} />
    </Stack>
  );
}
