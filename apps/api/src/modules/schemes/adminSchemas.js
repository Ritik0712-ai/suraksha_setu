import { z } from "zod";
import C from "../../config/constants.js";
import { ANSWER_FIELDS } from "./eligibility.js";

export const localized = (max = 300) =>
  z.object({ hi: z.string().trim().min(1).max(max), en: z.string().trim().min(1).max(max) });

const list = (max) => z.array(localized(max)).min(1).max(20);

const condition = z
  .object({
    field: z.enum(ANSWER_FIELDS),
    op: z.enum(C.eligibilityOps),
    value: z.union([z.string(), z.array(z.string()).min(1)]),
    failReason: localized(200),
    unknownReason: localized(200).optional(),
  })
  .superRefine((c, ctx) => {
    const allowed = C.eligibilityAnswers[c.field] ?? [];
    const multi = c.op === "in" || c.op === "nin";
    if (multi !== Array.isArray(c.value))
      return ctx.addIssue({ code: "custom", path: ["value"], message: "invalid" });
    const values = multi ? c.value : [c.value];
    if (!values.every((v) => allowed.includes(v)))
      ctx.addIssue({ code: "custom", path: ["value"], message: "invalid" });
  });

export const rulesSchema = z.object({
  all: z.array(condition).max(15).default([]),
  any: z.array(condition).max(15).default([]),
  alwaysCheck: z.array(localized(200)).max(10).default([]),
});

// docs/05 §5.8; both languages are required for every text (docs/03 A-09).
export const schemeBody = z.object({
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "invalid")
    .max(80),
  name: localized(120),
  summary: localized(400),
  benefitShort: localized(120),
  benefits: list(300),
  eligibilityText: list(300),
  rules: rulesSchema.nullable().optional(),
  documents: z
    .array(
      z.object({
        key: z.string().regex(/^[a-z0-9_]+$/),
        label: localized(80),
        icon: z.string().trim().max(40).optional(),
      }),
    )
    .min(1)
    .max(20),
  howToApply: list(300),
  whereToApply: list(300),
  officialUrl: z
    .string()
    .trim()
    .url()
    .regex(/^https:\/\//, "https_required"),
  sourceName: z.string().trim().min(2).max(120),
  helpline: z.string().trim().max(20).optional().nullable(),
  categories: z.array(z.enum(C.schemeCategories)).min(1),
  level: z.enum(C.schemeLevels),
  state: z.string().trim().max(10).optional().nullable(),
  tags: z.array(z.string().trim().min(1).max(40)).max(30).default([]),
});

export const adminListQuery = z.object({
  status: z.enum(C.schemeStatus).optional(),
  category: z.enum(C.schemeCategories).optional(),
  needsVerification: z.enum(["1", "true"]).optional(),
  q: z.string().trim().max(100).optional(),
});
