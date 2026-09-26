import { create } from "zustand";
import C from "../config/constants.js";
import { readStorage, STORAGE_KEYS, writeStorage } from "../lib/storage.js";

const savedLang = readStorage(STORAGE_KEYS.lang);
const savedSize = readStorage(STORAGE_KEYS.textSize);

export const initialLanguage = C.languages.includes(savedLang) ? savedLang : C.defaultLanguage;
const initialSize = C.textSizes.includes(savedSize) ? savedSize : C.defaultTextSize;

function applyTextSize(size) {
  // tokens.css: html[data-text-size="sm"|"lg"]; "md" is the default 18 px (docs/04 §11.1).
  document.documentElement.setAttribute("data-text-size", size);
}
applyTextSize(initialSize);

/**
 * Device preferences: language and text size (docs/03 §2.3, §2.4). `languageChosen` is false on
 * a first launch, which sends the user to S-01.
 */
export const usePrefs = create((set) => ({
  language: initialLanguage,
  languageChosen: Boolean(savedLang),
  textSize: initialSize,
  setLanguage(language) {
    writeStorage(STORAGE_KEYS.lang, language);
    set({ language, languageChosen: true });
  },
  setTextSize(textSize) {
    writeStorage(STORAGE_KEYS.textSize, textSize);
    applyTextSize(textSize);
    set({ textSize });
  },
}));
