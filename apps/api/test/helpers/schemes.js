import { Scheme } from "../../src/models/Scheme.js";

const L = (en, hi = `${en} (hi)`) => ({ hi, en });

/** A complete scheme body (what the admin editor sends). */
export function schemeBody(over = {}) {
  return {
    slug: "laadli-behna-yojana",
    name: L("Laadli Behna Yojana", "लाड़ली बहना योजना"),
    summary: L("Monthly help for women"),
    benefitShort: L("Monthly help for women"),
    benefits: [L("Monthly amount")],
    eligibilityText: [L("Women living in MP")],
    rules: {
      all: [
        {
          field: "gender",
          op: "eq",
          value: "female",
          failReason: L("This scheme is for women"),
        },
        {
          field: "ageBand",
          op: "in",
          value: ["21_40", "41_60"],
          failReason: L("Age must be 21 to 60"),
          unknownReason: L("Age will be checked"),
        },
      ],
      any: [],
      alwaysCheck: [],
    },
    documents: [
      { key: "aadhaar", label: L("Aadhaar"), icon: "badge" },
      { key: "samagra_id", label: L("Samagra ID") },
      { key: "bank_passbook", label: L("Bank passbook") },
    ],
    howToApply: [L("Apply at the Gram Panchayat")],
    whereToApply: [L("Gram Panchayat office")],
    officialUrl: "https://cmladlibahna.mp.gov.in",
    sourceName: "MP Govt.",
    categories: ["women"],
    level: "state",
    state: "MP",
    tags: ["ladli", "बहना"],
    ...over,
  };
}

/** Creates a published, verified scheme directly in the DB. */
export async function publishedScheme(actorId, over = {}) {
  return Scheme.create({
    ...schemeBody(over),
    status: "published",
    publishedAt: new Date(),
    lastVerifiedAt: new Date(),
    version: 1,
    createdBy: actorId,
    updatedBy: actorId,
    ...over,
  });
}
