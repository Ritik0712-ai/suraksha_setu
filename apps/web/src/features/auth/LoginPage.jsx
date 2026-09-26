import { useState } from "react";
import { Box, Divider, Link, Stack, Typography } from "@mui/material";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link as RouterLink, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { apiError } from "../../api/client.js";
import { authApi } from "../../api/endpoints.js";
import { toTenDigits } from "../../lib/phone.js";
import { safeNext } from "../../lib/nextPath.js";
import { isStaff, useSession } from "../../stores/session.js";
import { Notice } from "../../components/ui/Notice.jsx";
import { PasswordField, PhoneField, SubmitButton } from "../../components/ui/fields.jsx";
import { useFieldError } from "../../components/ui/useFieldError.js";
import { AuthCard } from "./AuthCard.jsx";
import { loginSchema } from "./schemas.js";

/** S-03 Login (docs/03). */
export default function LoginPage() {
  const { t } = useTranslation("auth");
  const fieldError = useFieldError();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const next = params.get("next");
  const setSession = useSession((s) => s.setSession);
  const [formError, setFormError] = useState(null);
  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { phone: "", password: "" },
    shouldFocusError: true,
  });

  const onSubmit = async (values) => {
    setFormError(null);
    try {
      const session = await authApi.login({
        phone: toTenDigits(values.phone),
        password: values.password,
      });
      setSession(session);
      navigate(isStaff(session.user) ? "/portal" : safeNext(next), { replace: true });
    } catch (err) {
      const e = apiError(err);
      setFormError(e.network ? t("states.networkError", { ns: "common" }) : e.message);
    }
  };

  return (
    <AuthCard title={t("login.title")}>
      <Stack component="form" noValidate spacing={2.5} onSubmit={handleSubmit(onSubmit)}>
        {(next || location.state?.pleaseLogIn) && (
          <Notice kind="info">{t("login.pleaseLogIn")}</Notice>
        )}
        {location.state?.message && <Notice kind="success">{location.state.message}</Notice>}
        <Controller
          name="phone"
          control={control}
          render={({ field }) => (
            <PhoneField
              {...field}
              id="login-phone"
              label={t("mobile")}
              error={Boolean(errors.phone)}
              helperText={fieldError(errors.phone)}
            />
          )}
        />
        <PasswordField
          {...register("password")}
          id="login-password"
          label={t("password")}
          autoComplete="current-password"
          error={Boolean(errors.password)}
          helperText={fieldError(errors.password)}
        />
        {formError && <Notice kind="error">{formError}</Notice>}
        <SubmitButton busy={isSubmitting}>{t("login.submit")}</SubmitButton>
        <Link component={RouterLink} to="/forgot-password" sx={{ alignSelf: "flex-start", py: 1 }}>
          {t("login.forgot")}
        </Link>
        <Divider />
        <Box>
          <Typography component="span">{t("login.newHere")} </Typography>
          <Link
            component={RouterLink}
            to={next ? `/register?next=${encodeURIComponent(next)}` : "/register"}
            sx={{ fontWeight: 700 }}
          >
            {t("login.registerLink")}
          </Link>
        </Box>
      </Stack>
    </AuthCard>
  );
}
