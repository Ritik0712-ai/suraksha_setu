import { z } from "zod";
import C from "../../config/constants.js";
import { objectId } from "../auth/schemas.js";

export const createSessionBody = z
  .object({
    mode: z.enum(C.chatModes),
    schemeId: objectId.optional(),
    letterType: z.enum(C.letterTypes).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.mode === "scheme_help" && !v.schemeId)
      ctx.addIssue({ code: "custom", path: ["schemeId"], message: "required" });
    if (v.mode === "letter" && !v.letterType)
      ctx.addIssue({ code: "custom", path: ["letterType"], message: "required" });
  });

export const messageBody = z.object({
  text: z.string().trim().min(1).max(C.sahayak.maxMessageChars),
  // The user tapped "No, I'm not in danger" on the emergency card: skip the keyword pre-check
  // for this one message so a false alarm ("accident insurance") still reaches Sahayak.
  skipEmergencyCheck: z.boolean().optional().default(false),
});

const line = (max) => z.string().trim().min(1).max(max);

// docs/05 §5.15 letter shape (S-26 edits).
export const letterBody = z.object({
  to: line(300),
  subject: line(200),
  body: line(3000),
  place: z.string().trim().max(120).optional().default(""),
  date: z.string().trim().max(20).optional().default(""),
  applicantName: line(120),
  mobile: z
    .string()
    .trim()
    .regex(/^\d{10}$/, "invalid_phone")
    .optional()
    .or(z.literal("")),
});

export const sessionParams = z.object({ id: objectId });
export const letterParams = z.object({ id: objectId, messageId: objectId });
