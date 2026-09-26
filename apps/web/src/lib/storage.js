// localStorage can be missing or throw (private mode, blocked site data). Every read and write
// goes through here so the app still works without it (docs/03 §2.3).
export function readStorage(key, fallback = null) {
  try {
    const v = window.localStorage.getItem(key);
    return v === null ? fallback : v;
  } catch {
    return fallback;
  }
}

export function writeStorage(key, value) {
  try {
    if (value === null || value === undefined) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Ignore: the choice just won't survive a reload.
  }
}

export function readJSON(key, fallback = null) {
  try {
    const v = readStorage(key);
    return v === null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}

export const writeJSON = (key, value) =>
  writeStorage(key, value === null || value === undefined ? null : JSON.stringify(value));

export const STORAGE_KEYS = {
  lang: "ss_lang",
  textSize: "ss_text_size",
  contacts: "ss_contacts", // cached for offline SOS (docs/03 S-28, doc 06 task 4A.9)
  schemesList: "ss_schemes_list", // last scheme list, for offline S-14
  schemesViewed: "ss_schemes_viewed", // last 10 viewed schemes, for offline S-15 (task 4C.4)
};
