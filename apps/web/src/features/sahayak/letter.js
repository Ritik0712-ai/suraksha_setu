import i18n from "../../i18n/index.js";

/** The letter's own language (it may differ from the UI language): Devanagari → Hindi. */
export const letterLanguage = (letter) =>
  /[ऀ-ॿ]/.test(`${letter?.subject ?? ""}${letter?.body ?? ""}`) ? "hi" : "en";

/** "A, B, C" recipient line → one line per part, as in a formal letter (docs/03 S-26). */
export const recipientLines = (to) =>
  String(to ?? "")
    .split(/,\s*/)
    .map((s) => s.trim())
    .filter(Boolean);

/**
 * The letter as plain text in its own language — the same layout as the preview — for Copy
 * and WhatsApp share. The Sahayak footer is added outside the letter.
 */
export function letterText(letter) {
  const lng = letterLanguage(letter);
  const f = (k) => i18n.t(`letter.format.${k}`, { ns: "sahayak", lng });
  return [
    f("to"),
    ...recipientLines(letter.to),
    "",
    `${f("subject")} ${letter.subject}`,
    "",
    f("salutation"),
    letter.body,
    "",
    f("thanks"),
    f("applicant"),
    letter.applicantName,
    ...(letter.place ? [letter.place] : []),
    ...(letter.mobile ? [`${f("mobile")} ${letter.mobile}`] : []),
    ...(letter.date ? [`${f("date")} ${letter.date}`] : []),
  ].join("\n");
}
