import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import C from "../config/constants.js";
import { initialLanguage } from "../stores/prefs.js";

// One JSON file per namespace per language; every key must exist in both (npm run i18n:check).
const files = import.meta.glob("./locales/*/*.json", { eager: true, import: "default" });
export const resources = {};
for (const [path, json] of Object.entries(files)) {
  const [, lang, ns] = path.match(/\.\/locales\/(\w+)\/(\w+)\.json$/);
  (resources[lang] ??= {})[ns] = json;
}

i18n.use(initReactI18next).init({
  resources,
  lng: initialLanguage, // saved device choice, else Hindi (docs/01 FR-GEN-01)
  supportedLngs: C.languages,
  fallbackLng: C.defaultLanguage,
  defaultNS: "common",
  ns: Object.keys(resources.hi ?? {}),
  interpolation: { escapeValue: false },
  returnNull: false,
});

// Keep <html lang> in sync so screen readers pronounce text correctly (docs/04 §9).
const syncHtmlLang = (lng) => document.documentElement.setAttribute("lang", lng);
syncHtmlLang(i18n.resolvedLanguage || C.defaultLanguage);
i18n.on("languageChanged", syncHtmlLang);

export default i18n;
