import { Router } from "express";
import { z } from "zod";
import { audit } from "../../lib/audit.js";
import { AppError } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { notify } from "../../lib/notify.js";
import { validate } from "../../middleware/validate.js";
import { SavedScheme } from "../../models/SavedScheme.js";
import { Scheme } from "../../models/Scheme.js";
import { objectId } from "../auth/schemas.js";
import { invalidateSchemes, matches } from "./cache.js";
import { adminListQuery, schemeBody } from "./adminSchemas.js";

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);
const idParam = { params: z.object({ id: objectId }) };
export const STALE_AFTER_DAYS = 90; // docs/05 §5.8

const adminView = (s) => ({
  ...s,
  id: String(s._id),
  _id: undefined,
  __v: undefined,
  stale:
    !s.lastVerifiedAt || Date.now() - new Date(s.lastVerifiedAt) > STALE_AFTER_DAYS * 86400_000,
});

async function load(id) {
  const s = await Scheme.findById(id);
  if (!s) throw new AppError("NOT_FOUND", "scheme_not_found");
  return s;
}

function slugTaken(err) {
  if (err?.code === 11000)
    return new AppError("CONFLICT", "slug_taken", [{ field: "slug", issue: "taken" }]);
  return err;
}

/** Tells everyone who saved the scheme that it changed (docs/05 §5.9 seenVersion). */
async function notifySavers(realtime, scheme) {
  const savers = await SavedScheme.find({ schemeId: scheme._id }).select("userId").lean();
  for (const s of savers)
    await notify(realtime, {
      recipientId: s.userId,
      type: "scheme_updated",
      templateKey: "notif.schemeUpdated",
      params: { name: scheme.name },
      link: `/schemes/${scheme.slug}`,
    }).catch((err) => logger.warn({ err }, "scheme notification failed"));
}

/** /api/v1/admin/schemes (docs/03 A-08, A-09). Mounted behind requireRole("admin"). */
export function adminSchemesRouter({ realtime }) {
  const router = Router();

  router.get(
    "/",
    validate({ query: adminListQuery }),
    wrap(async (req, res) => {
      const { status, category, needsVerification, q } = req.validatedQuery;
      const filter = {};
      if (status) filter.status = status;
      if (category) filter.categories = category;
      if (needsVerification)
        filter.$or = [
          { lastVerifiedAt: null },
          { lastVerifiedAt: { $lt: new Date(Date.now() - STALE_AFTER_DAYS * 86400_000) } },
        ];
      let list = await Scheme.find(filter)
        .select(
          "slug name categories level status lastVerifiedAt updatedAt version benefitShort tags",
        )
        .sort({ updatedAt: -1 })
        .lean();
      if (q) list = list.filter((s) => matches(s, q));
      res.json({ data: list.map(adminView) });
    }),
  );

  router.get(
    "/:id",
    validate(idParam),
    wrap(async (req, res) => res.json({ data: adminView((await load(req.params.id)).toObject()) })),
  );

  router.post(
    "/",
    validate({ body: schemeBody }),
    wrap(async (req, res) => {
      let s;
      try {
        s = await Scheme.create({
          ...req.body,
          status: "draft",
          createdBy: req.user._id,
          updatedBy: req.user._id,
        });
      } catch (err) {
        throw slugTaken(err);
      }
      await audit(req, { action: "scheme.created", targetType: "schemes", targetId: s._id });
      res.status(201).json({ data: adminView(s.toObject()) });
    }),
  );

  router.patch(
    "/:id",
    validate({ ...idParam, body: schemeBody }),
    wrap(async (req, res) => {
      const s = await load(req.params.id);
      s.set({ ...req.body, rules: req.body.rules ?? null, updatedBy: req.user._id });
      try {
        await s.save();
      } catch (err) {
        throw slugTaken(err);
      }
      if (s.status === "published") invalidateSchemes();
      await audit(req, { action: "scheme.updated", targetType: "schemes", targetId: s._id });
      res.json({ data: adminView(s.toObject()) });
    }),
  );

  // "Mark verified today" (docs/03 A-08).
  router.post(
    "/:id/verify",
    validate(idParam),
    wrap(async (req, res) => {
      const s = await load(req.params.id);
      s.set({ lastVerifiedAt: new Date(), verifiedBy: req.user._id, updatedBy: req.user._id });
      await s.save();
      if (s.status === "published") invalidateSchemes();
      await audit(req, { action: "scheme.verified", targetType: "schemes", targetId: s._id });
      res.json({ data: adminView(s.toObject()) });
    }),
  );

  // Publishing needs a verification date; every publish bumps the version (docs/05 §5.8).
  router.post(
    "/:id/publish",
    validate(idParam),
    wrap(async (req, res) => {
      const s = await load(req.params.id);
      if (!s.lastVerifiedAt) throw new AppError("CONFLICT", "scheme_not_verified");
      const wasPublished = s.status === "published";
      s.set({
        status: "published",
        publishedAt: new Date(),
        version: s.version + 1,
        updatedBy: req.user._id,
      });
      await s.save();
      invalidateSchemes();
      await audit(req, {
        action: "scheme.published",
        targetType: "schemes",
        targetId: s._id,
        changes: { version: [s.version - 1, s.version] },
      });
      if (wasPublished || s.version > 1) await notifySavers(realtime, s);
      res.json({ data: adminView(s.toObject()) });
    }),
  );

  router.post(
    "/:id/unpublish",
    validate(idParam),
    wrap(async (req, res) => {
      const s = await load(req.params.id);
      s.set({ status: "draft", updatedBy: req.user._id });
      await s.save();
      invalidateSchemes();
      await audit(req, { action: "scheme.unpublished", targetType: "schemes", targetId: s._id });
      res.json({ data: adminView(s.toObject()) });
    }),
  );

  router.post(
    "/:id/duplicate",
    validate(idParam),
    wrap(async (req, res) => {
      const src = (await load(req.params.id)).toObject();
      let slug = `${src.slug}-copy`;
      for (let n = 2; await Scheme.exists({ slug }); n += 1) slug = `${src.slug}-copy-${n}`;
      const {
        _id: _ignored,
        createdAt: _c,
        updatedAt: _u,
        publishedAt: _p,
        lastVerifiedAt: _l,
        verifiedBy: _v,
        __v: _x,
        ...rest
      } = src;
      const copy = await Scheme.create({
        ...rest,
        slug,
        status: "draft",
        version: 0,
        createdBy: req.user._id,
        updatedBy: req.user._id,
      });
      await audit(req, { action: "scheme.created", targetType: "schemes", targetId: copy._id });
      res.status(201).json({ data: adminView(copy.toObject()) });
    }),
  );

  router.delete(
    "/:id",
    validate(idParam),
    wrap(async (req, res) => {
      const s = await load(req.params.id);
      if (s.status !== "draft") throw new AppError("CONFLICT", "scheme_published");
      await s.deleteOne();
      await SavedScheme.deleteMany({ schemeId: s._id });
      await audit(req, { action: "scheme.deleted", targetType: "schemes", targetId: s._id });
      res.json({ data: { removed: true } });
    }),
  );

  return router;
}
