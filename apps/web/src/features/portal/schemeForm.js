import C from "../../config/constants.js";

// A-09 editor state ↔ API body (docs/05 §5.8).

const L = () => ({ hi: "", en: "" });

export function slugify(text) {
  return String(text ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function blankScheme() {
  return {
    slug: "",
    name: L(),
    summary: L(),
    benefitShort: L(),
    benefits: [L()],
    eligibilityText: [L()],
    rules: { all: [], any: [], alwaysCheck: [] },
    documents: [],
    extraDocuments: {},
    howToApply: [L()],
    whereToApply: [L()],
    officialUrl: "https://",
    sourceName: "",
    helpline: "",
    categories: [],
    level: "central",
    state: "",
    tags: "",
  };
}

export function fromApi(s) {
  const library = new Set(C.schemeDocuments.map((d) => d.key));
  const cond = (c) => ({ ...c, unknownReason: c.unknownReason ?? L() });
  return {
    ...blankScheme(),
    slug: s.slug,
    name: s.name,
    summary: s.summary,
    benefitShort: s.benefitShort,
    benefits: s.benefits,
    eligibilityText: s.eligibilityText,
    rules: s.rules
      ? {
          all: (s.rules.all ?? []).map(cond),
          any: (s.rules.any ?? []).map(cond),
          alwaysCheck: s.rules.alwaysCheck ?? [],
        }
      : { all: [], any: [], alwaysCheck: [] },
    documents: s.documents.map((d) => d.key),
    // Documents outside the library keep their own label.
    extraDocuments: Object.fromEntries(
      s.documents.filter((d) => !library.has(d.key)).map((d) => [d.key, d]),
    ),
    howToApply: s.howToApply,
    whereToApply: s.whereToApply,
    officialUrl: s.officialUrl,
    sourceName: s.sourceName,
    helpline: s.helpline ?? "",
    categories: s.categories,
    level: s.level,
    state: s.state ?? "",
    tags: (s.tags ?? []).join(", "),
  };
}

const filled = (x) => Boolean(x?.hi?.trim() || x?.en?.trim());

export function toBody(v) {
  const cond = ({ unknownReason, ...c }) => (filled(unknownReason) ? { ...c, unknownReason } : c);
  const rules = {
    all: v.rules.all.map(cond),
    any: v.rules.any.map(cond),
    alwaysCheck: v.rules.alwaysCheck.filter(filled),
  };
  const hasRules = rules.all.length || rules.any.length || rules.alwaysCheck.length;
  const doc = (key) => {
    const lib = C.schemeDocuments.find((d) => d.key === key);
    if (lib) return { key, label: lib.label, icon: lib.icon };
    return v.extraDocuments[key];
  };
  return {
    slug: v.slug.trim(),
    name: v.name,
    summary: v.summary,
    benefitShort: v.benefitShort,
    benefits: v.benefits.filter(filled),
    eligibilityText: v.eligibilityText.filter(filled),
    rules: hasRules ? rules : null,
    documents: v.documents.map(doc).filter(Boolean),
    howToApply: v.howToApply.filter(filled),
    whereToApply: v.whereToApply.filter(filled),
    officialUrl: v.officialUrl.trim(),
    sourceName: v.sourceName.trim(),
    helpline: v.helpline.trim() || null,
    categories: v.categories,
    level: v.level,
    state: v.level === "state" ? v.state.trim() || null : null,
    tags: v.tags
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean),
  };
}
