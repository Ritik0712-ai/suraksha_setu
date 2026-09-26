import { createHash, createHmac, randomBytes, randomInt } from "node:crypto";
import jwt from "jsonwebtoken";
import { AppError } from "./errors.js";

export const ACCESS_TOKEN_TTL_SEC = 15 * 60; // docs/02 §6.2
export const REFRESH_COOKIE = "ss_rt";
export const REFRESH_COOKIE_PATH = "/api/v1/auth";

/** Session lifetime by role: 30 days for citizens, 12 hours for authority/admin. */
export function sessionTtlMs(role) {
  return role === "citizen" ? 30 * 24 * 3600 * 1000 : 12 * 3600 * 1000;
}

/** JWT payload from docs/05 §7.2: { sub, role, jur, dept, ver }. */
export function signAccessToken(user, secret) {
  const isStaff = user.role !== "citizen";
  const jur = isStaff
    ? (user.authority?.jurisdictionIds ?? []).map(String)
    : user.jurisdictionId
      ? [String(user.jurisdictionId)]
      : [];
  const dept = isStaff && user.authority?.departmentId ? String(user.authority.departmentId) : null;
  return jwt.sign({ role: user.role, jur, dept, ver: user.tokenVersion ?? 0 }, secret, {
    algorithm: "HS256",
    subject: String(user._id),
    expiresIn: ACCESS_TOKEN_TTL_SEC,
  });
}

export function verifyAccessToken(token, secret) {
  try {
    return jwt.verify(token, secret, { algorithms: ["HS256"] });
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) throw new AppError("TOKEN_EXPIRED");
    throw new AppError("UNAUTHENTICATED");
  }
}

/** 256-bit opaque token (refresh tokens, email reset links). */
export const randomToken = () => randomBytes(32).toString("base64url");

/** 6-digit admin-issued reset code, zero-padded. */
export const randomCode = () => String(randomInt(0, 1_000_000)).padStart(6, "0");

/** SHA-256 of secret + pepper, hex. Stored instead of the raw token/code. */
export const hashSecret = (secret, pepper) =>
  createHash("sha256").update(`${secret}${pepper}`).digest("hex");

/**
 * Public SOS tracking token (docs/01 FR-SOS-06). Derived from the SOS id with an HMAC keyed by
 * the server secret, so the owner can always get their link back (e.g. reopening S-07 on
 * another device) while nobody without the secret can guess it. Only its hash is stored.
 */
export const trackTokenFor = (sosId, pepper) =>
  createHmac("sha256", pepper).update(`sos-track:${sosId}`).digest("base64url");
