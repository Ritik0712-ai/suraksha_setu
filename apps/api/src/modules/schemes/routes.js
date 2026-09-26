import { Router } from "express";
import { z } from "zod";
import { AppError } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { optionalAuth, requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { SavedScheme } from "../../models/SavedScheme.js";
import { Scheme } from "../../models/Scheme.js";
import { UsageEvent } from "../../models/UsageEvent.js";
import { User } from "../../models/User.js";
import { objectId } from "../auth/schemas.js";
import { matches, publishedSchemes } from "./cache.js";
import { evaluateScheme } from "./eligibility.js";
import { eligibilityBody, listQuery, savedBody } from "./schemas.js";

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);
const track = (doc) =>
  UsageEvent.create(doc).catch((err) => logger.warn({ err }, "usage event failed"));

export const cardView = (s) => ({
  id: String(s._id),
  slug: s.slug,
  name: s.name,
  benefitShort: s.benefitShort,
  categories: s.categories,
  level: s.level,
  state: s.state ?? null,
});

export const detailView = (s) => ({
  ...cardView(s),
  summary: s.summary,
  benefits: s.benefits,
  eligibilityText: s.eligibilityText,
  documents: s.documents.map((d) => ({ key: d.key, label: d.label, icon: d.icon ?? null })),
  howToApply: s.howToApply,
  whereToApply: s.whereToApply,
  officialUrl: s.officialUrl,
  sourceName: s.sourceName,
  helpline: s.helpline ?? null,
  lastVerifiedAt: s.lastVerifiedAt ?? null,
  publishedAt: s.publishedAt ?? null,
  version: s.version,
});

/** /api/v1/schemes — public catalogue and eligibility checker (docs/02 §7.2 "Schemes (M3)"). */
export function schemesRouter({ env }) {
  const router = Router();

  router.get(
    "/",
    validate({ query: listQuery }),
    wrap(async (req, res) => {
      const { category, level, q } = req.validatedQuery;
      const list = (await publishedSchemes()).filter(
        (s) =>
          (!category || s.categories.includes(category)) &&
          (!level || s.level === level) &&
          (!q || matches(s, q)),
      );
      res.set("Cache-Control", "public, max-age=60");
      res.json({ data: list.map(cardView) });
    }),
  );

  // Public; with a login the answers can be kept and the check is counted (docs/02 §7.2).
  router.post(
    "/eligibility",
    optionalAuth(env),
    validate({ body: eligibilityBody }),
    wrap(async (req, res) => {
      const { answers, save } = req.body;
      const results = (await publishedSchemes()).map((s) => ({
        ...cardView(s),
        schemeId: String(s._id),
        ...evaluateScheme(s.rules, answers),
      }));
      const order = { likely: 0, maybe: 1, no: 2 };
      results.sort((a, b) => order[a.result] - order[b.result]);

      const counts = { likely: 0, maybe: 0, no: 0 };
      for (const r of results) counts[r.result] += 1;
      track({ type: "eligibility_completed", userId: req.user?._id ?? null, props: counts });
      if (save && req.user?.role === "citizen")
        await User.updateOne({ _id: req.user._id }, { eligibilityAnswers: answers });
      res.json({ data: { results, counts } });
    }),
  );

  router.get(
    "/:slug",
    optionalAuth(env),
    validate({ params: z.object({ slug: z.string().regex(/^[a-z0-9-]{1,80}$/) }) }),
    wrap(async (req, res) => {
      const s = (await publishedSchemes()).find((x) => x.slug === req.params.slug);
      if (!s) throw new AppError("NOT_FOUND", "scheme_not_found");
      let saved = null;
      if (req.user?.role === "citizen") {
        // Viewing a saved scheme marks its current version as seen (docs/05 §5.9).
        const doc = await SavedScheme.findOneAndUpdate(
          { userId: req.user._id, schemeId: s._id },
          { seenVersion: s.version },
          { new: true },
        ).lean();
        if (doc) saved = { checkedDocuments: doc.checkedDocuments };
      }
      track({
        type: "scheme_view",
        userId: req.user?._id ?? null,
        props: { slug: s.slug.slice(0, 40) },
      });
      res.json({ data: { ...detailView(s), saved } });
    }),
  );

  return router;
}

/** /api/v1/users/me/saved-schemes — bookmarks with a document checklist (S-18). */
export function savedSchemesRouter({ env }) {
  const router = Router();
  router.use(requireAuth(env), requireRole("citizen"));
  const idParam = { params: z.object({ schemeId: objectId }) };

  router.get(
    "/",
    wrap(async (req, res) => {
      const saved = await SavedScheme.find({ userId: req.user._id }).sort({ updatedAt: -1 }).lean();
      const byId = new Map((await publishedSchemes()).map((s) => [String(s._id), s]));
      const items = saved
        .filter((x) => byId.has(String(x.schemeId)))
        .map((x) => {
          const s = byId.get(String(x.schemeId));
          const keys = new Set(s.documents.map((d) => d.key));
          return {
            ...cardView(s),
            documentsTotal: keys.size,
            documentsReady: x.checkedDocuments.filter((k) => keys.has(k)).length,
            checkedDocuments: x.checkedDocuments,
            updated: s.version > x.seenVersion,
          };
        });
      res.json({ data: items });
    }),
  );

  router.put(
    "/:schemeId",
    validate({ ...idParam, body: savedBody }),
    wrap(async (req, res) => {
      const s = await Scheme.findOne({ _id: req.params.schemeId, status: "published" })
        .select("documents version")
        .lean();
      if (!s) throw new AppError("NOT_FOUND", "scheme_not_found");
      const keys = new Set(s.documents.map((d) => d.key));
      const update = { seenVersion: s.version };
      if (req.body.checkedDocuments)
        update.checkedDocuments = [...new Set(req.body.checkedDocuments)].filter((k) =>
          keys.has(k),
        );
      const doc = await SavedScheme.findOneAndUpdate(
        { userId: req.user._id, schemeId: s._id },
        { $set: update },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      ).lean();
      res.json({ data: { schemeId: String(s._id), checkedDocuments: doc.checkedDocuments } });
    }),
  );

  router.delete(
    "/:schemeId",
    validate(idParam),
    wrap(async (req, res) => {
      await SavedScheme.deleteOne({ userId: req.user._id, schemeId: req.params.schemeId });
      res.json({ data: { removed: true } });
    }),
  );

  return router;
}
