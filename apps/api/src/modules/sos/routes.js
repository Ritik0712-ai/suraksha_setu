import { Router } from "express";
import { z } from "zod";
import C from "../../config/constants.js";
import { audit } from "../../lib/audit.js";
import { AppError } from "../../lib/errors.js";
import { assertInScope, scopeFilter } from "../../lib/scope.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { SosAlert } from "../../models/SosAlert.js";
import { User } from "../../models/User.js";
import { objectId } from "../auth/schemas.js";
import { closeBody, locationBody, revealBody, triggerBody } from "./schemas.js";

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);
const idParam = { params: z.object({ id: objectId }) };
const citizen = requireRole("citizen");
const staff = requireRole("authority", "admin");

/** /api/v1/sos (docs/02 §7.2 "SOS (M1)"). SOS is never rate-limited (docs/02 SEC-06). */
export function sosRouter({ env, sos }) {
  const router = Router();
  router.use(requireAuth(env));

  /** Loads an SOS an authority may act on: SOS scope ignores the department (docs/05 §8). */
  async function inScope(req) {
    const doc = await SosAlert.findById(req.params.id);
    if (!doc) throw new AppError("NOT_FOUND");
    assertInScope(req.user, doc, { ignoreDepartment: true });
    return doc;
  }

  // --- citizen -------------------------------------------------------------------------------

  router.post(
    "/",
    citizen,
    validate({ body: triggerBody }),
    wrap(async (req, res) => {
      const { view, existing } = await sos.trigger(req.user._id, req.body);
      res.status(existing ? 200 : 201).json({ data: { ...view, existing } });
    }),
  );

  router.get(
    "/mine",
    citizen,
    validate({ query: z.object({ open: z.enum(["1", "true"]).optional() }) }),
    wrap(async (req, res) => {
      res.json({ data: await sos.mine(req.user._id, { open: Boolean(req.validatedQuery.open) }) });
    }),
  );

  router.post(
    "/:id/location",
    citizen,
    validate({ ...idParam, body: locationBody }),
    wrap(async (req, res) =>
      res.json({ data: await sos.pushLocation(req.user._id, req.params.id, req.body) }),
    ),
  );

  router.post(
    "/:id/resolve",
    citizen,
    validate(idParam),
    wrap(async (req, res) => res.json({ data: await sos.resolve(req.user._id, req.params.id) })),
  );

  // --- authority / admin -------------------------------------------------------------------

  // Active SOS in scope, or everything from the last 24 h with ?window=24h (A-04 tabs).
  router.get(
    "/active",
    staff,
    validate({ query: z.object({ window: z.enum(["24h"]).optional() }) }),
    wrap(async (req, res) => {
      const filter = scopeFilter(req.user, { ignoreDepartment: true });
      if (req.validatedQuery.window === "24h")
        filter.triggeredAt = { $gte: new Date(Date.now() - 24 * 3600 * 1000) };
      else filter.status = { $in: C.sosOpenStatus };
      const list = await SosAlert.find(filter).sort({ triggeredAt: -1 }).limit(200);
      res.json({ data: await Promise.all(list.map((d) => sos.authorityView(d))) });
    }),
  );

  router.get(
    "/:id",
    validate(idParam),
    wrap(async (req, res) => {
      if (req.user.role === "citizen")
        return res.json({ data: await sos.ownerDetail(req.user._id, req.params.id) });
      const doc = await inScope(req);
      res.json({ data: await sos.authorityView(doc, { detail: true }) });
    }),
  );

  router.post(
    "/:id/acknowledge",
    staff,
    validate(idParam),
    wrap(async (req, res) => {
      const doc = await sos.acknowledge(req.user, await inScope(req));
      await audit(req, { action: "sos.acknowledged", targetType: "sos_alerts", targetId: doc._id });
      res.json({ data: await sos.authorityView(doc, { detail: true }) });
    }),
  );

  router.post(
    "/:id/close",
    staff,
    validate({ ...idParam, body: closeBody }),
    wrap(async (req, res) => {
      const doc = await sos.close(req.user, await inScope(req), req.body);
      await audit(req, {
        action: "sos.closed",
        targetType: "sos_alerts",
        targetId: doc._id,
        changes: { closeOutcome: [null, req.body.outcome] },
      });
      res.json({ data: await sos.authorityView(doc, { detail: true }) });
    }),
  );

  // Reveals the citizen's or one contact's phone, audited (docs/02 §7.2, docs/03 A-05).
  router.post(
    "/:id/reveal-phone",
    staff,
    validate({ ...idParam, body: revealBody }),
    wrap(async (req, res) => {
      const doc = await inScope(req);
      let phone;
      if (req.body.target === "user")
        phone = (await User.findById(doc.userId).select("phone").lean())?.phone;
      else phone = doc.contactsSnapshot[req.body.index]?.phone;
      if (!phone) throw new AppError("NOT_FOUND");
      await audit(req, {
        action: "sos.phone_revealed",
        targetType: "sos_alerts",
        targetId: doc._id,
        changes: {
          target: [null, req.body.target === "user" ? "user" : `contact:${req.body.index}`],
        },
      });
      res.json({ data: { phone } });
    }),
  );

  return router;
}

/** GET /api/v1/track/:token — public, no login (docs/01 FR-SOS-06, docs/03 S-30). */
export function trackRouter({ sos, limiter }) {
  const router = Router();
  router.get(
    "/:token",
    limiter,
    validate({ params: z.object({ token: z.string().min(20).max(100) }) }),
    wrap(async (req, res) => {
      res.set("Cache-Control", "no-store");
      res.set("Referrer-Policy", "no-referrer");
      res.json({ data: await sos.track(req.params.token) });
    }),
  );
  return router;
}
