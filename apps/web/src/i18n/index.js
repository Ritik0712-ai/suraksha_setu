import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import C from "../config/constants.js";
import { initialLanguage } from "../stores/prefs.js";

// One JSON file per namespace per language; every key must exist in both (npm run i18n:check).
// Namespaces only some screens need load with those screens, keeping the citizen app's first
// download small (docs/02 §5: ≤ 250 KB gz); the rest ship with the app.
export const LAZY_NAMESPACES = [
  "portal",
  "schemes",
  "blood",
  "emergency",
  "notifications",
  "sahayak",
];
const all = import.meta.glob(
  [
    "./locales/*/portal.json",
    "./locales/*/schemes.json",
    "./locales/*/blood.json",
    "./locales/*/emergency.json",
    "./locales/*/notifications.json",
    "./locales/*/sahayak.json",
  ],
  { import: "default" },
);
const eager = import.meta.glob(
  [
    "./locales/*/*.json",
    "!./locales/*/portal.json",
    "!./locales/*/schemes.json",
    "!./locales/*/blood.json",
    "!./locales/*/emergency.json",
    "!./locales/*/notifications.json",
    "!./locales/*/sahayak.json",
  ],
  { eager: true, import: "default" },
);
const parse = (path) => path.match(/\.\/locales\/(\w+)\/(\w+)\.json$/).slice(1);
export const resources = {};
for (const [path, json] of Object.entries(eager)) {
  const [lang, ns] = parse(path);
  (resources[lang] ??= {})[ns] = json;
}

const loading = new Map();
/** Loads lazy namespaces (both languages) before a screen renders; see router.jsx. */
export function loadNamespaces(namespaces = []) {
  return Promise.all(
    namespaces.map((ns) => {
      if (!loading.has(ns))
        loading.set(
          ns,
          Promise.all(
            Object.entries(all)
              .filter(([path]) => parse(path)[1] === ns)
              .map(async ([path, load]) => {
                const [lang] = parse(path);
                i18n.addResourceBundle(lang, ns, await load(), true, true);
              }),
          ),
        );
      return loading.get(ns);
    }),
  );
}

i18n.use(initReactI18next).init({
  resources,
  lng: initialLanguage, // saved device choice, else Hindi (docs/01 FR-GEN-01)
  supportedLngs: C.languages,
  fallbackLng: C.defaultLanguage,
  defaultNS: "common",
  ns: Object.keys(resources.hi ?? {}),
  partialBundledLanguages: true,
  interpolation: { escapeValue: false },
  returnNull: false,
});

// Keep <html lang> in sync so screen readers pronounce text correctly (docs/04 §9).
const syncHtmlLang = (lng) => document.documentElement.setAttribute("lang", lng);
syncHtmlLang(i18n.resolvedLanguage || C.defaultLanguage);
i18n.on("languageChanged", syncHtmlLang);

export default i18n;
