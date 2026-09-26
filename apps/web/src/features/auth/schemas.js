import { z } from "zod";
import { toTenDigits } from "../../lib/phone.js";

// Client-side rules mirror the API (apps/api/src/modules/auth/schemas.js). Messages are issue
// codes, translated by useFieldError() from common:errors.*.

export const phoneRule = z
  .string()
  .min(1, "required")
  .refine((v) => toTenDigits(v) !== null, "invalid_phone");

export const passwordRule = z
  .string()
  .min(1, "required")
  .min(8, "password_too_short")
  .refine((v) => !/^\d+$/.test(v), "only_digits");

export const nameRule = z
  .string()
  .trim()
  .min(2, "too_short")
  .max(60, "too_long")
  .refine((v) => /^[\p{L}\p{M}][\p{L}\p{M}\s.'-]*$/u.test(v), "invalid_name");

export const optionalEmail = z
  .string()
  .trim()
  .max(254, "too_long")
  .refine((v) => v === "" || z.string().email().safeParse(v).success, "invalid_email");

export const loginSchema = z.object({
  phone: phoneRule,
  password: z.string().min(1, "required"),
});

export const registerSchema = z
  .object({
    name: nameRule,
    phone: phoneRule,
    village: z.object({ id: z.string(), label: z.string() }).nullable(),
    notListed: z.boolean(),
    villageOther: z.string().trim().max(80, "too_long"),
    password: passwordRule,
    gender: z.string(),
    consent: z.boolean().refine((v) => v, "consent_required"),
  })
  .superRefine((v, ctx) => {
    if (v.notListed && v.villageOther.length < 2)
      ctx.addIssue({ code: "custom", path: ["villageOther"], message: "required" });
    if (!v.notListed && !v.village)
      ctx.addIssue({ code: "custom", path: ["village"], message: "village_required" });
  });

const withConfirm = (shape) =>
  z
    .object({ ...shape, password: passwordRule, confirm: z.string().min(1, "required") })
    .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "mismatch" });

export const resetTokenSchema = withConfirm({});
export const resetCodeSchema = withConfirm({
  phone: phoneRule,
  code: z.string().regex(/^\d{6}$/, "invalid_code"),
});
export const forgotSchema = z.object({ phone: phoneRule });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "required"),
    newPassword: passwordRule,
    confirm: z.string().min(1, "required"),
  })
  .refine((v) => v.newPassword === v.confirm, { path: ["confirm"], message: "mismatch" });

/** Puts server field errors ({ field, issue }) onto the form. Returns true if any matched. */
export function applyServerErrors(err, setError, fieldMap = {}) {
  let matched = false;
  for (const d of err?.details ?? []) {
    const field = fieldMap[d.field] ?? d.field;
    if (field) {
      setError(field, { type: "server", message: d.issue });
      matched = true;
    }
  }
  return matched;
}
