// Exports every UI string (and the API's fixed messages) as a CSV for the native Hindi review (docs/04 §10, doc 06 task 8.1):
// namespace, key, English, Hindi, and empty "reviewed Hindi" / "notes" columns for the reviewer.
// Usage: npm run i18n:sheet -w apps/web [-- out.csv]   (default: i18n-review.csv)
// Open it in Google Sheets/Excel (UTF-8). Copy approved changes back into locales/hi/*.json.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../src/i18n/locales", import.meta.url));
const out = process.argv[2] || "i18n-review.csv";

function flatten(obj, prefix = "") {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object" ? flatten(v, `${prefix}${k}.`) : [[`${prefix}${k}`, String(v)]],
  );
}

const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
const rows = [["namespace", "key", "English", "Hindi", "reviewed Hindi", "notes"]];
for (const file of readdirSync(join(root, "en")).sort()) {
  const ns = file.replace(/\.json$/, "");
  const en = Object.fromEntries(flatten(JSON.parse(readFileSync(join(root, "en", file), "utf8"))));
  const hi = Object.fromEntries(flatten(JSON.parse(readFileSync(join(root, "hi", file), "utf8"))));
  for (const key of Object.keys(en)) rows.push([ns, key, en[key], hi[key] ?? "", "", ""]);
}
// The API's own texts: error messages and Sahayak's fixed replies (plain { en, hi } pairs).
// SOS SMS/email and complaint-email wording are templates in apps/api/src/modules/sos/texts.js
// and complaints/texts.js — review those by reading the file.
const api = (rel) => import(new URL(`../../api/src/${rel}`, import.meta.url));
const apiTexts = [
  ["api:messages", (await api("lib/messages.js")).MESSAGES],
  ["api:sahayak", await api("modules/chat/texts.js")],
];
function pairs(obj, prefix = "") {
  if (!obj || typeof obj !== "object") return [];
  if (typeof obj.en === "string" && typeof obj.hi === "string") return [[prefix, obj.en, obj.hi]];
  return Object.entries(obj).flatMap(([k, v]) => pairs(v, prefix ? `${prefix}.${k}` : k));
}
for (const [ns, obj] of apiTexts)
  for (const [key, en, hi] of pairs(obj)) rows.push([ns, key, en, hi, "", ""]);

// BOM so Excel opens the file as UTF-8 (Devanagari stays readable).
writeFileSync(out, "﻿" + rows.map((r) => r.map(cell).join(",")).join("\n") + "\n");
console.log(`${rows.length - 1} strings → ${out}`);
