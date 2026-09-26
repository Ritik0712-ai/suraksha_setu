import { useState } from "react";
import { Stack, TextField } from "@mui/material";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { apiError } from "../../api/client.js";
import { authApi } from "../../api/endpoints.js";
import { toTenDigits } from "../../lib/phone.js";
import { Notice } from "../../components/ui/Notice.jsx";
import { PasswordField, PhoneField, SubmitButton } from "../../components/ui/fields.jsx";
import { useFieldError } from "../../components/ui/useFieldError.js";
import { AuthCard } from "./AuthCard.jsx";
import { resetCodeSchema, resetTokenSchema } from "./schemas.js";

/** S-05b Reset password: token mode (?token= from the email) or admin-code mode. */
export default function ResetPasswordPage() {
  const { t } = useTranslation("auth");
  const fieldError = useFieldError();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token");
  const [formError, setFormError] = useState(null);
  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(token ? resetTokenSchema : resetCodeSchema),
    defaultValues: { phone: "", code: "", password: "", confirm: "" },
  });

  const onSubmit = async (v) => {
    setFormError(null);
    try {
      await authApi.reset(
        token
          ? { token, password: v.password }
          : { phone: toTenDigits(v.phone), code: v.code, password: v.password },
      );
      navigate("/login", { replace: true, state: { message: t("reset.done") } });
    } catch (err) {
      const e = apiError(err);
      setFormError(e.network ? t("states.networkError", { ns: "common" }) : e.message);
    }
  };

  return (
    <AuthCard title={t("reset.title")}>
      <Stack component="form" noValidate spacing={2.5} onSubmit={handleSubmit(onSubmit)}>
        {!token && (
          <>
            <Controller
              name="phone"
              control={control}
              render={({ field }) => (
                <PhoneField
                  {...field}
                  id="reset-phone"
                  label={t("mobile")}
                  error={Boolean(errors.phone)}
                  helperText={fieldError(errors.phone)}
                />
              )}
            />
            <TextField
              {...register("code")}
              id="reset-code"
              label={t("reset.code")}
              fullWidth
              autoComplete="one-time-code"
              inputProps={{ inputMode: "numeric", maxLength: 6 }}
              error={Boolean(errors.code)}
              helperText={fieldError(errors.code)}
            />
          </>
        )}
        <PasswordField
          {...register("password")}
          id="reset-password"
          label={t("reset.newPassword")}
          autoComplete="new-password"
          error={Boolean(errors.password)}
          helperText={fieldError(errors.password) ?? t("register.passwordHint")}
        />
        <PasswordField
          {...register("confirm")}
          id="reset-confirm"
          label={t("reset.confirmPassword")}
          autoComplete="new-password"
          error={Boolean(errors.confirm)}
          helperText={fieldError(errors.confirm)}
        />
        {formError && <Notice kind="error">{formError}</Notice>}
        <SubmitButton busy={isSubmitting}>{t("reset.submit")}</SubmitButton>
      </Stack>
    </AuthCard>
  );
}
