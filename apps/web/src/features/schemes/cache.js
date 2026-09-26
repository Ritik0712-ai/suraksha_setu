import { readJSON, STORAGE_KEYS, writeJSON } from "../../lib/storage.js";

// Offline copies (doc 06 task 4C.4): the last full scheme list and the last 10 viewed schemes.
export const MAX_VIEWED = 10;

export const cachedList = () => readJSON(STORAGE_KEYS.schemesList, null);
export const cacheList = (list) => writeJSON(STORAGE_KEYS.schemesList, list);

export function cachedScheme(slug) {
  return (readJSON(STORAGE_KEYS.schemesViewed, []) ?? []).find((s) => s.slug === slug) ?? null;
}

export function cacheScheme(scheme) {
  const { saved: _saved, ...plain } = scheme; // per-user state stays out of the cache
  const rest = (readJSON(STORAGE_KEYS.schemesViewed, []) ?? []).filter(
    (s) => s.slug !== plain.slug,
  );
  writeJSON(STORAGE_KEYS.schemesViewed, [plain, ...rest].slice(0, MAX_VIEWED));
}

export const isNetworkError = (err) => !err?.response;
