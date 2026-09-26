import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import C from "../config/constants.js";
import hiCommon from "./locales/hi/common.json";
import enCommon from "./locales/en/common.json";

// Namespaces per module are added here as modules are built (docs/02 §3). Hindi is the default.
export const resources = {
  hi: { common: hiCommon },
  en: { common: enCommon },
};

export const LANG_STORAGE_KEY = "ss_lang";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    supportedLngs: C.languages,
    fallbackLng: C.defaultLanguage,
    defaultNS: "common",
    interpolation: { escapeValue: false },
    // Only a saved choice counts; the browser language must not override the Hindi default.
    detection: {
      order: ["localStorage"],
      lookupLocalStorage: LANG_STORAGE_KEY,
      caches: ["localStorage"],
    },
  });

// Keep <html lang> in sync so screen readers pronounce text correctly (docs/04 §9).
const syncHtmlLang = (lng) => document.documentElement.setAttribute("lang", lng);
syncHtmlLang(i18n.resolvedLanguage || C.defaultLanguage);
i18n.on("languageChanged", syncHtmlLang);

export default i18n;
