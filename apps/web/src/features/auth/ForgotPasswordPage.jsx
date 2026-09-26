import { useState } from "react";
import { Button, Stack, Typography } from "@mui/material";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link as RouterLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { apiError } from "../../api/client.js";
import { authApi } from "../../api/endpoints.js";
import { toTenDigits } from "../../lib/phone.js";
import { Notice } from "../../components/ui/Notice.jsx";
import { PhoneField, SubmitButton } from "../../components/ui/fields.jsx";
import { useFieldError } from "../../components/ui/useFieldError.js";
import { AuthCard } from "./AuthCard.jsx";
import { forgotSchema } from "./schemas.js";

/** S-05 Forgot password: the answer never reveals whether the number or an email exists. */
export default function ForgotPasswordPage() {
  const { t } = useTranslation("auth");
  const fieldError = useFieldError();
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(forgotSchema), defaultValues: { phone: "" } });

  const onSubmit = async ({ phone }) => {
    setFormError(null);
    try {
      await authApi.forgot({ phone: toTenDigits(phone) });
      setSent(true);
    } catch (err) {
      const e = apiError(err);
      setFormError(e.network ? t("states.networkError", { ns: "common" }) : e.message);
    }
  };

  return (
    <AuthCard title={t("forgot.title")}>
      {sent ? (
        <Stack spacing={2.5}>
          <Notice kind="success">{t("forgot.sent")}</Notice>
          <Button variant="contained" component={RouterLink} to="/reset-password">
            {t("forgot.haveCode")}
          </Button>
        </Stack>
      ) : (
        <Stack component="form" noValidate spacing={2.5} onSubmit={handleSubmit(onSubmit)}>
          <Typography>{t("forgot.intro")}</Typography>
          <Controller
            name="phone"
            control={control}
            render={({ field }) => (
              <PhoneField
                {...field}
                id="forgot-phone"
                label={t("mobile")}
                error={Boolean(errors.phone)}
                helperText={fieldError(errors.phone)}
              />
            )}
          />
          {formError && <Notice kind="error">{formError}</Notice>}
          <SubmitButton busy={isSubmitting}>{t("actions.continue", { ns: "common" })}</SubmitButton>
          <Button variant="text" component={RouterLink} to="/reset-password">
            {t("forgot.haveCode")}
          </Button>
        </Stack>
      )}
    </AuthCard>
  );
}
