import { Scheme } from "../../models/Scheme.js";

// docs/05 §5.8: the catalogue is small, so published schemes live in memory for 5 minutes and
// the cache is dropped whenever an admin publishes, unpublishes or edits a published scheme.
const TTL_MS = 5 * 60 * 1000;
let cached = null;

export function invalidateSchemes() {
  cached = null;
}

export async function publishedSchemes() {
  if (cached && cached.expires > Date.now()) return cached.list;
  const list = await Scheme.find({ status: "published" })
    .select("-createdBy -updatedBy -verifiedBy -__v")
    .sort({ "name.en": 1 })
    .lean();
  cached = { list, expires: Date.now() + TTL_MS };
  return list;
}

/** Lower-case, Unicode-normalised, without zero-width characters or Hindi nukta variants. */
export function normalise(s) {
  return String(s ?? "")
    .normalize("NFC")
    .toLowerCase()
    .replace(/\u200b|\u200c|\u200d|\u093c/g, "")
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, " ")
    .trim();
}

export function matches(scheme, q) {
  const words = normalise(q).split(" ").filter(Boolean);
  if (!words.length) return true;
  const hay = normalise(
    [
      scheme.name.hi,
      scheme.name.en,
      scheme.benefitShort.hi,
      scheme.benefitShort.en,
      ...(scheme.tags ?? []),
    ].join(" "),
  );
  return words.every((w) => hay.includes(w));
}
