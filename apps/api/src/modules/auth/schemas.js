import { z } from "zod";
import mongoose from "mongoose";
import C from "../../config/constants.js";
import { normalizePhone } from "../../lib/phone.js";
import { passwordIssue } from "../../lib/password.js";

// Request schemas for /auth and /users/me (docs/02 §7.2, docs/03 S-03…S-05b, S-27).

export const phone = z.unknown().transform((v, ctx) => {
  if (v === undefined || v === null || v === "") {
    ctx.addIssue({ code: "custom", message: "required" });
    return z.NEVER;
  }
  const p = normalizePhone(v);
  if (!p) {
    ctx.addIssue({ code: "custom", message: "invalid_phone" });
    return z.NEVER;
  }
  return p;
});

export const password = z.string().superRefine((v, ctx) => {
  const issue = passwordIssue(v);
  if (issue) ctx.addIssue({ code: "custom", message: issue });
});

export const objectId = z
  .string()
  .refine((v) => mongoose.isValidObjectId(v), { message: "invalid_id" });

// 2–60 characters, letters (any script, including Devanagari matras) and spaces. Dots, hyphens
// and apostrophes are allowed for initials and names like "D'Souza".
export const personName = z
  .string()
  .trim()
  .min(2)
  .max(60)
  .refine((v) => /^[\p{L}\p{M}][\p{L}\p{M}\s.'-]*$/u.test(v), { message: "invalid_name" });

export const email = z.string().trim().toLowerCase().email().max(254);

const villageFields = {
  jurisdictionId: objectId.optional(),
  villageOther: z.string().trim().min(2).max(80).optional(),
};

export const registerBody = z
  .object({
    name: personName,
    phone,
    password,
    ...villageFields,
    language: z.enum(C.languages).optional(),
    gender: z.enum(C.genders).optional(),
    consent: z.boolean().refine((v) => v === true, { message: "consent_required" }),
  })
  .superRefine((v, ctx) => {
    if (!v.jurisdictionId && !v.villageOther)
      ctx.addIssue({ code: "custom", path: ["jurisdictionId"], message: "required" });
  });

export const loginBody = z.object({
  phone,
  password: z.string().min(1).max(200),
});

export const forgotBody = z.object({ phone });

export const resetBody = z.union([
  z.object({ token: z.string().min(20).max(200), password }),
  z.object({ phone, code: z.string().regex(/^\d{6}$/, "invalid_code"), password }),
]);

export const changePasswordBody = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: password,
});

export const updateMeBody = z
  .object({
    name: personName.optional(),
    language: z.enum(C.languages).optional(),
    textSize: z.enum(C.textSizes).optional(),
    gender: z.enum(C.genders).nullable().optional(),
    email: email.nullable().optional(),
    ...villageFields,
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: "empty_update" });
