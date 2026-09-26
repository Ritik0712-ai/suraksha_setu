import { randomBytes } from "node:crypto";
import C from "../config/constants.js";
import { hashPassword } from "../lib/password.js";
import { normalizePhone } from "../lib/phone.js";
import { Jurisdiction } from "../models/Jurisdiction.js";
import { User } from "../models/User.js";

/** 12-character temporary password that always passes the password rules. */
export const tempPassword = () => `Ss-${randomBytes(9).toString("base64url")}`;

/**
 * Creates one admin per team member (docs/06 task 1.9, docs/05 §11.5) with
 * mustChangePassword: true. Existing phones are skipped, never overwritten.
 * @returns [{ name, phone, status: "created" | "exists", tempPassword? }]
 */
export async function seedAdmins(members, { bcryptCost }) {
  const home = await Jurisdiction.findOne({ type: "district", active: true }).sort({
    createdAt: 1,
  });
  if (!home) throw new Error("No district jurisdiction found. Run db:seed:jurisdictions first.");

  const results = [];
  for (const m of members) {
    const phone = normalizePhone(m.phone);
    if (!phone) throw new Error(`Invalid phone for ${m.name}: ${m.phone}`);
    if (await User.exists({ phone })) {
      results.push({ name: m.name, phone, status: "exists" });
      continue;
    }
    const password = tempPassword();
    await User.create({
      name: m.name,
      phone,
      email: m.email?.toLowerCase() || null,
      passwordHash: await hashPassword(password, bcryptCost),
      role: "admin",
      jurisdictionId: home._id,
      mustChangePassword: true,
      consent: { version: C.consentVersion, acceptedAt: new Date() },
    });
    results.push({ name: m.name, phone, status: "created", tempPassword: password });
  }
  return results;
}
