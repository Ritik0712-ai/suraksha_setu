import { useTranslation } from "react-i18next";

/** Translates a field error: `errors.<code>` keys, or a server message as-is. */
export function useFieldError() {
  const { t, i18n } = useTranslation();
  return (err) => {
    if (!err?.message) return undefined;
    const key = `errors.${err.message}`;
    return i18n.exists(key, { ns: "common" }) ? t(key, { ns: "common" }) : err.message;
  };
}
