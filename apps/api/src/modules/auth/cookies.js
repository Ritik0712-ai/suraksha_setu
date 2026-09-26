import { REFRESH_COOKIE, REFRESH_COOKIE_PATH } from "../../lib/tokens.js";

// Refresh cookie (docs/02 §6.2): httpOnly, Secure, SameSite=Lax, scoped to /api/v1/auth.
// Secure is dropped outside production so http://localhost works.
function options(env) {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: REFRESH_COOKIE_PATH,
  };
}

export function setRefreshCookie(res, env, token, expiresAt) {
  res.cookie(REFRESH_COOKIE, token, {
    ...options(env),
    maxAge: Math.max(0, expiresAt.getTime() - Date.now()),
  });
}

export function clearRefreshCookie(res, env) {
  res.clearCookie(REFRESH_COOKIE, options(env));
}

export const readRefreshCookie = (req) => req.cookies?.[REFRESH_COOKIE];
