import { Autocomplete, TextField } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useVillages } from "./useVillages.js";

/** Village picker for S-04 and S-27. Value: { id, label } | null. */
export function VillageAutocomplete({ id, value, onChange, error, helperText }) {
  const { t, i18n } = useTranslation("auth");
  const lang = i18n.resolvedLanguage === "en" ? "en" : "hi";
  const villages = useVillages();
  const options = (villages.data ?? []).map((v) => ({ id: v.id, label: v.name[lang] }));
  return (
    <Autocomplete
      id={id}
      options={options}
      value={value}
      onChange={(_e, v) => onChange(v ? { id: v.id, label: v.label } : null)}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      loading={villages.isLoading}
      noOptionsText={t("register.villageNone")}
      renderInput={(params) => (
        <TextField
          {...params}
          label={t("register.village")}
          placeholder={t("register.villageSearch")}
          error={error}
          helperText={helperText}
        />
      )}
    />
  );
}
