import { randomBytes } from "node:crypto";
import bcrypt from "bcrypt";

// Password rules (docs/02 §6.1): at least 8 characters, not only digits. bcrypt reads at most
// 72 bytes, so longer input is rejected rather than silently truncated.
export function passwordIssue(pw) {
  if (typeof pw !== "string" || pw.length === 0) return "required";
  if (pw.length < 8) return "too_short";
  if (Buffer.byteLength(pw, "utf8") > 72) return "too_long";
  if (/^\d+$/.test(pw)) return "only_digits";
  return null;
}

export const hashPassword = (pw, cost) => bcrypt.hash(pw, cost);
export const verifyPassword = (pw, hash) => bcrypt.compare(pw, hash);

// Compared against when the phone isn't registered, so a login takes the same time either way.
const DUMMY_HASH = "$2b$12$ArLsMN/85uzb0jTORwWEqOQj7ibeALtHUqYzOirykWW4q.3W9SW2G";
export const burnTime = (pw) => bcrypt.compare(pw ?? "", DUMMY_HASH);

/** 12-character temporary password that always passes the password rules. */
export const tempPassword = () => `Ss-${randomBytes(9).toString("base64url")}`;
