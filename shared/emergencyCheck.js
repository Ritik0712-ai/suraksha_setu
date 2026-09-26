// Sahayak emergency pre-check (docs/02 §4.4, docs/06 4G.3), shared by the API and the web app so
// both apply exactly the same rule. The word list lives in constants.json → sahayak.

const NUKTA = /़/g;

/** Lower-case, drop punctuation and nukta, collapse spaces; padded with spaces for matching. */
export function normalizeForCheck(text) {
  const plain = String(text ?? "")
    .normalize("NFC")
    .toLowerCase()
    .replace(NUKTA, "")
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, " ")
    .trim();
  return plain ? ` ${plain} ` : "";
}

const hit = (padded, phrase) => padded.includes(` ${normalizeForCheck(phrase).trim()}`);

/**
 * True when a Sahayak message suggests an emergency.
 * @param text    the user's message
 * @param config  constants.json → sahayak ({ emergencyKeywords: { strong, weak }, weakMaxWords })
 */
export function isEmergencyMessage(text, config) {
  const padded = normalizeForCheck(text);
  if (!padded) return false;
  const { strong = [], weak = [] } = config?.emergencyKeywords ?? {};
  if (strong.some((p) => hit(padded, p))) return true;
  const words = padded.trim().split(" ").length;
  return words <= (config?.weakMaxWords ?? 4) && weak.some((p) => hit(padded, p));
}
