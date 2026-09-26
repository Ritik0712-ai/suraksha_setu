import { useEffect, useState } from "react";
import {
  Box,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormHelperText,
  FormLabel,
  Link,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link as RouterLink, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import C from "../../config/constants.js";
import { apiError } from "../../api/client.js";
import { authApi } from "../../api/endpoints.js";
import { toTenDigits } from "../../lib/phone.js";
import { usePrefs } from "../../stores/prefs.js";
import { useSession } from "../../stores/session.js";
import { Notice } from "../../components/ui/Notice.jsx";
import { PasswordField, PhoneField, SubmitButton } from "../../components/ui/fields.jsx";
import { useFieldError } from "../../components/ui/useFieldError.js";
import { AuthCard } from "./AuthCard.jsx";
import { applyServerErrors, registerSchema } from "./schemas.js";
import { useVillages } from "./useVillages.js";
import { VillageAutocomplete } from "./VillageAutocomplete.jsx";

/** S-04 Register (docs/03): 4 required fields + consent; optional gender. */
export default function RegisterPage() {
  const { t, i18n } = useTranslation("auth");
  const fieldError = useFieldError();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const language = usePrefs((s) => s.language);
  const setSession = useSession((s) => s.setSession);
  const [formError, setFormError] = useState(null);
  const [phoneTaken, setPhoneTaken] = useState(false);
  const lang = i18n.resolvedLanguage === "en" ? "en" : "hi";

  const villages = useVillages();

  const {
    control,
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      phone: "",
      village: null,
      notListed: false,
      villageOther: "",
      password: "",
      gender: "",
      consent: false,
    },
  });
  const notListed = watch("notListed");

  // Default suggestion: Mahodiya, the pilot village (docs/03 S-04).
  useEffect(() => {
    if (getValues("village") || !villages.data) return;
    const mahodiya = villages.data.find((v) => v.name.en === "Mahodiya");
    if (mahodiya) setValue("village", { id: mahodiya.id, label: mahodiya.name[lang] });
  }, [villages.data, getValues, setValue, lang]);

  const onSubmit = async (v) => {
    setFormError(null);
    setPhoneTaken(false);
    try {
      const session = await authApi.register({
        name: v.name,
        phone: toTenDigits(v.phone),
        password: v.password,
        ...(v.notListed ? { villageOther: v.villageOther } : { jurisdictionId: v.village.id }),
        ...(v.gender ? { gender: v.gender } : {}),
        language,
        consent: true,
      });
      setSession(session);
      navigate("/profile/contacts?onboarding=1", { replace: true });
    } catch (err) {
      const e = apiError(err);
      if (e.status === 409) setPhoneTaken(true);
      const matched = applyServerErrors(e, setError, { jurisdictionId: "village" });
      if (!matched)
        setFormError(e.network ? t("states.networkError", { ns: "common" }) : e.message);
    }
  };

  const next = params.get("next");

  return (
    <AuthCard title={t("register.title")}>
      <Stack component="form" noValidate spacing={2.5} onSubmit={handleSubmit(onSubmit)}>
        <TextField
          {...register("name")}
          id="reg-name"
          label={t("register.name")}
          autoComplete="name"
          fullWidth
          error={Boolean(errors.name)}
          helperText={fieldError(errors.name)}
        />
        <Box>
          <Controller
            name="phone"
            control={control}
            render={({ field }) => (
              <PhoneField
                {...field}
                id="reg-phone"
                label={t("mobile")}
                error={Boolean(errors.phone)}
                helperText={fieldError(errors.phone)}
              />
            )}
          />
          {phoneTaken && (
            <Link
              component={RouterLink}
              to={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}
              sx={{ display: "inline-block", mt: 1, fontWeight: 700, py: 0.5 }}
            >
              {t("register.loginInstead")}
            </Link>
          )}
        </Box>

        {!notListed && (
          <Controller
            name="village"
            control={control}
            render={({ field }) => (
              <VillageAutocomplete
                id="reg-village"
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
                  checked={field.value}
                  onChange={(e) => field.onChange(e.target.checked)}
                />
              }
              label={t("register.notListed")}
            />
          )}
        />
        {notListed && (
          <TextField
            {...register("villageOther")}
            id="reg-village-other"
            label={t("register.villageOther")}
            fullWidth
            error={Boolean(errors.villageOther)}
            helperText={fieldError(errors.villageOther)}
          />
        )}

        <PasswordField
          {...register("password")}
          id="reg-password"
          label={t("password")}
          autoComplete="new-password"
          error={Boolean(errors.password)}
          helperText={fieldError(errors.password) ?? t("register.passwordHint")}
        />

        <Controller
          name="gender"
          control={control}
          render={({ field }) => (
            <FormControl>
              <FormLabel id="reg-gender-label" sx={{ color: "text.primary", fontWeight: 500 }}>
                {t("register.gender")}
              </FormLabel>
              <RadioGroup
                aria-labelledby="reg-gender-label"
                aria-describedby="reg-gender-help"
                value={field.value}
                onChange={(e) => field.onChange(e.target.value)}
              >
                {C.genders.map((g) => (
                  <FormControlLabel
                    key={g}
                    value={g}
                    control={<Radio />}
                    label={t(`register.genders.${g}`)}
                    sx={{ minHeight: 48 }}
                  />
                ))}
              </RadioGroup>
              <FormHelperText id="reg-gender-help" sx={{ mx: 0 }}>
                {t("register.genderHelp")}
              </FormHelperText>
            </FormControl>
          )}
        />

        <Controller
          name="consent"
          control={control}
          render={({ field }) => (
            <FormControl error={Boolean(errors.consent)}>
              <FormControlLabel
                sx={{ alignItems: "flex-start" }}
                control={
                  <Checkbox
                    checked={field.value}
                    onChange={(e) => field.onChange(e.target.checked)}
                    inputProps={{ "aria-describedby": "reg-consent-error" }}
                    sx={{ mt: -0.5 }}
                  />
                }
                label={
                  <Typography variant="body2" sx={{ pt: 0.75 }}>
                    {t("register.consent")}{" "}
                    <Link component={RouterLink} to="/privacy" target="_blank">
                      {t("register.readMore")}
                    </Link>
                  </Typography>
                }
              />
              {errors.consent && (
                <FormHelperText id="reg-consent-error">{fieldError(errors.consent)}</FormHelperText>
              )}
            </FormControl>
          )}
        />

        {formError && <Notice kind="error">{formError}</Notice>}
        <SubmitButton busy={isSubmitting}>{t("register.submit")}</SubmitButton>
        <Box>
          <Typography component="span">{t("register.haveAccount")} </Typography>
          <Link component={RouterLink} to="/login" sx={{ fontWeight: 700 }}>
            {t("actions.logIn", { ns: "common" })}
          </Link>
        </Box>
      </Stack>
    </AuthCard>
  );
}
