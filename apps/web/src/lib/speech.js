import { create } from "zustand";

// Read-aloud and voice typing with the browser's own speech engines (free, no API key). Many
// villagers find reading hard and typing Hindi on a cheap phone harder still, so both matter
// more here than in most apps. Everything degrades silently: no engine → no button.

const LOCALES = { hi: "hi-IN", en: "en-IN" };
export const speechLocale = (lang) => LOCALES[lang] ?? "hi-IN";

export const canSpeak = () =>
  typeof window !== "undefined" &&
  "speechSynthesis" in window &&
  typeof window.SpeechSynthesisUtterance === "function";

export const recognitionClass = () =>
  typeof window === "undefined"
    ? null
    : (window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null);
export const canListen = () => Boolean(recognitionClass());

/** Turns Markdown/plain text into something worth hearing: no symbols, links or URLs. */
export function speakableText(text) {
  return String(text ?? "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // [label](url) → label
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[*_#>`|~]+/g, " ")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/**
 * Splits text into sentence-sized pieces. Chrome on Android stops long utterances after ~15 s,
 * so each piece stays short and they are queued one after another.
 */
export function speechChunks(text, max = 180) {
  const parts = speakableText(text)
    .split(/(?<=[।.!?\n])\s*/u)
    .map((s) => s.trim())
    .filter(Boolean);
  const out = [];
  for (const p of parts) {
    if (p.length <= max) {
      out.push(p);
      continue;
    }
    // A very long sentence: break at commas or spaces.
    let rest = p;
    while (rest.length > max) {
      let cut = Math.max(rest.lastIndexOf(",", max), rest.lastIndexOf(" ", max));
      if (cut < max / 2) cut = max;
      out.push(rest.slice(0, cut).trim());
      rest = rest.slice(cut).replace(/^[,\s]+/, "");
    }
    if (rest) out.push(rest);
  }
  return out;
}

function pickVoice(locale) {
  try {
    const voices = window.speechSynthesis.getVoices() ?? [];
    const base = locale.split("-")[0];
    return (
      voices.find((v) => v.lang === locale) ??
      voices.find((v) => v.lang?.replace("_", "-").toLowerCase().startsWith(base)) ??
      null
    );
  } catch {
    return null;
  }
}

/** Which button is speaking right now (only one at a time across the app). */
export const useSpeaking = create(() => ({ id: null }));

export function stopSpeaking() {
  if (canSpeak()) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }
  useSpeaking.setState({ id: null });
}

/** Reads `text` aloud; `id` marks which button started it. Returns false if it can't. */
export function speak(text, { id = "speech", lang = "hi", rate = 0.9 } = {}) {
  if (!canSpeak()) return false;
  const chunks = speechChunks(text);
  if (!chunks.length) return false;
  stopSpeaking();
  const locale = speechLocale(lang);
  const voice = pickVoice(locale);
  useSpeaking.setState({ id });
  chunks.forEach((chunk, i) => {
    const u = new window.SpeechSynthesisUtterance(chunk);
    u.lang = locale;
    if (voice) u.voice = voice;
    u.rate = rate; // a little slower than default: easier to follow
    if (i === chunks.length - 1) {
      u.onend = () => {
        if (useSpeaking.getState().id === id) useSpeaking.setState({ id: null });
      };
    }
    u.onerror = () => {
      if (useSpeaking.getState().id === id) useSpeaking.setState({ id: null });
    };
    window.speechSynthesis.speak(u);
  });
  return true;
}

/** Appends spoken words to an existing text value. */
export const appendSpoken = (current, said, max = Infinity) =>
  `${current ? `${current.replace(/\s+$/, "")} ` : ""}${said}`.slice(0, max);
