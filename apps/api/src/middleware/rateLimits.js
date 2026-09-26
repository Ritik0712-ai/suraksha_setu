import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { AppError } from "../lib/errors.js";
import { normalizePhone } from "../lib/phone.js";

// Auth rate limits from docs/02 SEC-06. SOS is never rate-limited (and never goes through here).
const MIN = 60 * 1000;

function limiter({ windowMs, limit, key, skipSuccessfulRequests = false }) {
  return rateLimit({
    windowMs,
    limit,
    skipSuccessfulRequests,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator: key ?? ((req) => ipKeyGenerator(req.ip)),
    handler: (_req, _res, next) => next(new AppError("RATE_LIMITED")),
  });
}

const passthrough = (_req, _res, next) => next();

/** @param enabled  false turns every limiter into a no-op (used by tests of other behaviour). */
export function createAuthLimiters(enabled = true) {
  if (!enabled)
    return {
      login: passthrough,
      register: passthrough,
      passwordReset: passthrough,
      track: passthrough,
    };
  return {
    // 5 failed logins per 15 min per phone + IP
    login: limiter({
      windowMs: 15 * MIN,
      limit: 5,
      skipSuccessfulRequests: true,
      key: (req) => `${normalizePhone(req.body?.phone) ?? "-"}|${ipKeyGenerator(req.ip)}`,
    }),
    // 5 registrations per hour per IP
    register: limiter({ windowMs: 60 * MIN, limit: 5 }),
    // 3 password-reset requests per hour per IP
    passwordReset: limiter({ windowMs: 60 * MIN, limit: 3 }),
    // Public SOS tracking page refreshes every 30 s; this only stops token guessing.
    track: limiter({ windowMs: MIN, limit: 60 }),
  };
}
