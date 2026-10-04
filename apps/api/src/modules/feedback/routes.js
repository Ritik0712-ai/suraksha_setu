import { Router } from "express";
import { z } from "zod";
import C from "../../config/constants.js";
import { AppError } from "../../lib/errors.js";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { ChatMessage } from "../../models/ChatMessage.js";
import { Feedback } from "../../models/Feedback.js";
import { Scheme } from "../../models/Scheme.js";
import { objectId } from "../auth/schemas.js";

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

const voteBody = z.object({
  target: z.enum(C.feedbackTargets),
  targetId: objectId,
  helpful: z.boolean(),
});

const mineQuery = z.object({
  target: z.enum(C.feedbackTargets),
  ids: z
    .string()
    .transform((s) => [...new Set(s.split(",").filter(Boolean))])
    .pipe(z.array(objectId).min(1).max(50)),
});

/** Only things the person could actually see: their own Sahayak replies, published schemes. */
async function exists(user, target, id) {
  if (target === "sahayak_reply")
    return ChatMessage.exists({ _id: id, userId: user._id, role: "assistant" });
  return Scheme.exists({ _id: id, status: "published" });
}

/** POST /feedback — 👍/👎; GET /feedback/mine — the caller's votes for the items on screen. */
export function feedbackRouter({ env }) {
  const router = Router();
  router.use(requireAuth(env));

  router.post(
    "/",
    validate({ body: voteBody }),
    wrap(async (req, res) => {
      const { target, targetId, helpful } = req.body;
      if (!(await exists(req.user, target, targetId))) throw new AppError("NOT_FOUND");
      await Feedback.updateOne(
        { userId: req.user._id, target, targetId },
        { $set: { helpful, jurisdictionId: req.user.jurisdictionId ?? null } },
        { upsert: true },
      );
      res.json({ data: { target, targetId, helpful } });
    }),
  );

  router.get(
    "/mine",
    validate({ query: mineQuery }),
    wrap(async (req, res) => {
      const { target, ids } = req.validatedQuery;
      const rows = await Feedback.find({ userId: req.user._id, target, targetId: { $in: ids } })
        .select("targetId helpful")
        .lean();
      res.json({ data: Object.fromEntries(rows.map((r) => [String(r.targetId), r.helpful])) });
    }),
  );
  return router;
}
