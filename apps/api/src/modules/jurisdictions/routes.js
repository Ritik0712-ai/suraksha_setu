import { Router } from "express";
import { z } from "zod";
import C from "../../config/constants.js";
import { validate } from "../../middleware/validate.js";
import { Jurisdiction } from "../../models/Jurisdiction.js";

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** GET /api/v1/jurisdictions?type=village&q= — public village picker for S-04 (docs/02 §7.2). */
export function jurisdictionsRouter() {
  const router = Router();

  router.get(
    "/",
    validate({
      query: z.object({
        type: z.enum(C.jurisdictionTypes).optional(),
        q: z.string().trim().max(60).optional(),
      }),
    }),
    wrap(async (req, res) => {
      const { type, q } = req.validatedQuery;
      const filter = { active: true };
      if (type) filter.type = type;
      if (q) {
        const rx = new RegExp(escapeRegex(q), "i");
        filter.$or = [{ "name.en": rx }, { "name.hi": rx }];
      }
      const rows = await Jurisdiction.find(filter)
        .select("name type parentId")
        .sort({ "name.en": 1 })
        .limit(50)
        .lean();
      res.json({
        data: rows.map((j) => ({
          id: String(j._id),
          name: j.name,
          type: j.type,
          parentId: j.parentId ? String(j.parentId) : null,
        })),
      });
    }),
  );

  return router;
}
