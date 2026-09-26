import { useTranslation } from "react-i18next";

/** Picks the current language from a { hi, en } text (server data). */
export function useLocalized() {
  const { i18n } = useTranslation();
  const lang = i18n.resolvedLanguage === "en" ? "en" : "hi";
  return (text) => (text ? (text[lang] ?? text.hi ?? text.en ?? "") : "");
}

/** Saves a Blob as a file (CSV exports). */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Rows → CSV text (with BOM for Excel + Hindi), cells that look like formulas are quoted. */
export function toCsv(rows) {
  const cell = (v) => {
    let s = v === null || v === undefined ? "" : String(v);
    if (/^[=+\-@]/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return `\uFEFF${rows.map((r) => r.map(cell).join(",")).join("\r\n")}\r\n`;
}
