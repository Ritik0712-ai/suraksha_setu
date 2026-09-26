import { Stack } from "@mui/material";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { apiError } from "../../api/client.js";
import { usersApi } from "../../api/endpoints.js";
import { useSession } from "../../stores/session.js";
import { toast } from "../../stores/toast.js";
import { ResponsiveDialog } from "../../components/ui/ResponsiveDialog.jsx";
import { Notice } from "../../components/ui/Notice.jsx";
import { PasswordField, SubmitButton } from "../../components/ui/fields.jsx";
import { useFieldError } from "../../components/ui/useFieldError.js";
import { applyServerErrors, changePasswordSchema } from "../auth/schemas.js";

/**
 * A-14: an admin-created account (temporary password) must set a new password before using any
 * portal screen. The dialog can't be dismissed.
 */
export function ForceChangePassword() {
  const { t } = useTranslation("profile");
  const fieldError = useFieldError();
  const user = useSession((s) => s.user);
  const setSession = useSession((s) => s.setSession);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirm: "" },
  });

  const onSubmit = async (v) => {
    try {
      const session = await usersApi.changePassword({
        currentPassword: v.currentPassword,
        newPassword: v.newPassword,
      });
      setSession(session);
      toast(t("passwordChanged"));
    } catch (err) {
      const e = apiError(err);
      if (!applyServerErrors(e, setError)) setError("root", { message: e.message });
    }
  };

  return (
    <ResponsiveDialog
      open={Boolean(user?.mustChangePassword)}
      title={t("changePassword")}
      labelId="force-change-title"
    >
      <Stack component="form" noValidate spacing={2.5} onSubmit={handleSubmit(onSubmit)}>
        <Notice kind="warning">{t("mustChange")}</Notice>
        <PasswordField
          {...register("currentPassword")}
          id="fc-current"
          label={t("currentPassword")}
          autoComplete="current-password"
          error={Boolean(errors.currentPassword)}
          helperText={fieldError(errors.currentPassword)}
        />
        <PasswordField
          {...register("newPassword")}
          id="fc-new"
          label={t("newPassword")}
          autoComplete="new-password"
          error={Boolean(errors.newPassword)}
          helperText={fieldError(errors.newPassword)}
        />
        <PasswordField
          {...register("confirm")}
          id="fc-confirm"
          label={t("confirmPassword")}
          autoComplete="new-password"
          error={Boolean(errors.confirm)}
          helperText={fieldError(errors.confirm)}
        />
        {errors.root && <Notice kind="error">{errors.root.message}</Notice>}
        <SubmitButton busy={isSubmitting}>{t("actions.save", { ns: "common" })}</SubmitButton>
      </Stack>
    </ResponsiveDialog>
  );
}
