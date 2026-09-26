import { AppError } from "../lib/errors.js";
import { verifyAccessToken } from "../lib/tokens.js";
import { User } from "../models/User.js";

// docs/05 §7.4: verify the access token, then load { _id, role, status, tokenVersion, authority }
// for the user, cached for 60 s. Anything that changes those fields must call invalidateUser().
const CACHE_TTL_MS = 60_000;
const cache = new Map();

export function invalidateUser(userId) {
  cache.delete(String(userId));
}

/** Cached user lookup shared by REST auth and the Socket.IO handshake. */
export async function loadUser(id) {
  const hit = cache.get(id);
  if (hit && hit.expires > Date.now()) return hit.user;
  const user = await User.findById(id)
    .select("_id role status tokenVersion authority jurisdictionId")
    .lean();
  if (user) cache.set(id, { user, expires: Date.now() + CACHE_TTL_MS });
  return user;
}

export function requireAuth(env) {
  return async (req, _res, next) => {
    try {
      const header = req.headers.authorization || "";
      const [scheme, token] = header.split(" ");
      if (scheme !== "Bearer" || !token) throw new AppError("UNAUTHENTICATED");

      const payload = verifyAccessToken(token, env.JWT_ACCESS_SECRET);
      const user = await loadUser(payload.sub);
      if (!user || user.status !== "active" || user.tokenVersion !== payload.ver)
        throw new AppError("UNAUTHENTICATED");

      req.user = user;
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** requireRole("authority", "admin") — use after requireAuth. */
export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) return next(new AppError("FORBIDDEN"));
    next();
  };
}
