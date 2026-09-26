import { z } from "zod";
import C from "../../config/constants.js";
import { ANSWER_FIELDS } from "./eligibility.js";

export const listQuery = z.object({
  category: z.enum(C.schemeCategories).optional(),
  level: z.enum(C.schemeLevels).optional(),
  q: z.string().trim().max(100).optional(),
});

// Every answer is optional (skipped questions count as unknown); values come from constants.
export const answersSchema = z
  .object(
    Object.fromEntries(ANSWER_FIELDS.map((f) => [f, z.enum(C.eligibilityAnswers[f]).optional()])),
  )
  .strict();

export const eligibilityBody = z.object({
  answers: answersSchema,
  // Logged-in users may keep their answers on their profile (docs/03 S-16 privacy note).
  save: z.boolean().optional(),
});

export const savedBody = z.object({
  checkedDocuments: z
    .array(z.string().regex(/^[a-z0-9_]+$/))
    .max(30)
    .optional(),
});
