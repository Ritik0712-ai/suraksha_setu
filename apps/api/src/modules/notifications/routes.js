import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { Notification } from "../../models/Notification.js";
import { objectId } from "../auth/schemas.js";

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);
const PAGE = 20;

const view = (n) => ({
  id: String(n._id),
  type: n.type,
  templateKey: n.templateKey,
  params: n.params ?? {},
  link: n.link ?? null,
  read: Boolean(n.readAt),
  createdAt: n.createdAt,
});

/** /api/v1/notifications (docs/02 §7.2, docs/03 S-29). */
export function notificationsRouter({ env }) {
  const router = Router();
  router.use(requireAuth(env));

  router.get(
    "/",
    validate({ query: z.object({ page: z.coerce.number().int().min(1).max(100).default(1) }) }),
    wrap(async (req, res) => {
      const { page } = req.validatedQuery;
      const mine = { recipientId: req.user._id };
      const [docs, unread] = await Promise.all([
        Notification.find(mine)
          .sort({ createdAt: -1, _id: -1 })
          .skip((page - 1) * PAGE)
          .limit(PAGE + 1)
          .lean(),
        Notification.countDocuments({ ...mine, readAt: null }),
      ]);
      res.json({
        data: {
          items: docs.slice(0, PAGE).map(view),
          nextPage: docs.length > PAGE ? page + 1 : null,
          unread,
        },
      });
    }),
  );

  router.post(
    "/read",
    validate({
      body: z.union([
        z.object({ ids: z.array(objectId).min(1).max(100) }),
        z.object({ all: z.literal(true) }),
      ]),
    }),
    wrap(async (req, res) => {
      const filter = { recipientId: req.user._id, readAt: null };
      if (req.body.ids) filter._id = { $in: req.body.ids };
      const { modifiedCount } = await Notification.updateMany(filter, { readAt: new Date() });
      const unread = await Notification.countDocuments({ recipientId: req.user._id, readAt: null });
      res.json({ data: { marked: modifiedCount, unread } });
    }),
  );

  return router;
}
