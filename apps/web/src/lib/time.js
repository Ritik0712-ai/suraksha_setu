import i18n from "../i18n/index.js";

/** "2 मिनट पहले" / "2 min ago" in the current language. */
export function timeAgo(date, now = Date.now()) {
  const sec = Math.round((new Date(date).getTime() - now) / 1000);
  const lang = i18n.resolvedLanguage === "en" ? "en-IN" : "hi-IN";
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto", style: "short" });
  const abs = Math.abs(sec);
  if (abs < 60) return rtf.format(sec, "second");
  if (abs < 3600) return rtf.format(Math.round(sec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(sec / 3600), "hour");
  return rtf.format(Math.round(sec / 86400), "day");
}

/** "26 सित॰ 2026, 10:14 pm" in IST (docs/03 §0.3). */
export function formatDateTime(date) {
  const lang = i18n.resolvedLanguage === "en" ? "en-IN" : "hi-IN";
  return new Intl.DateTimeFormat(lang, {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
}

/** "26 सित॰ 2026" in IST. */
export function formatDate(date) {
  const lang = i18n.resolvedLanguage === "en" ? "en-IN" : "hi-IN";
  return new Intl.DateTimeFormat(lang, {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}
