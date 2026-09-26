import { Router } from "express";
import { z } from "zod";
import { logger } from "../../lib/logger.js";
import { optionalAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { UsageEvent } from "../../models/UsageEvent.js";

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

// Only these may come from the browser; the rest are recorded server-side (docs/05 §5.18).
const CLIENT_EVENTS = ["app_install", "emergency_call_tap"];
const scalar = z.union([z.string().max(40), z.number(), z.boolean(), z.null()]);

const eventBody = z.object({
  type: z.enum(CLIENT_EVENTS),
  anonId: z
    .string()
    .regex(/^[A-Za-z0-9_-]{8,64}$/)
    .optional(),
  props: z
    .record(z.string().max(30), scalar)
    .refine((o) => Object.keys(o).length <= 8)
    .default({}),
});

const errorBody = z.object({
  message: z.string().max(500),
  path: z.string().max(200).optional(),
  stack: z.string().max(2000).optional(),
  release: z.string().max(40).optional(),
});

/** POST /events, POST /client-errors (docs/02 §7.2 supporting endpoints). Rate-limited. */
export function eventsRouter({ env, limiter }) {
  const router = Router();

  router.post(
    "/events",
    limiter,
    optionalAuth(env),
    validate({ body: eventBody }),
    wrap(async (req, res) => {
      await UsageEvent.create({ ...req.body, userId: req.user?._id ?? null });
      res.status(202).json({ data: { ok: true } });
    }),
  );

  // Logs only (no PII expected; the client strips query strings).
  router.post("/client-errors", limiter, validate({ body: errorBody }), (req, res) => {
    logger.warn({ clientError: req.body }, "client error");
    res.status(202).json({ data: { ok: true } });
  });

  return router;
}
