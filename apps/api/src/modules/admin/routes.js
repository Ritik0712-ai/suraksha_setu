import { Router } from "express";
import { z } from "zod";
import { audit } from "../../lib/audit.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { objectId } from "../auth/schemas.js";

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

/** /api/v1/admin/* — only the endpoints Phase 1 needs so far. The rest arrive with task 4E.4. */
export function adminRouter({ env, auth }) {
  const router = Router();
  router.use(requireAuth(env), requireRole("admin"));

  // One-time password reset code for users without email (docs/02 §6.2, docs/03 A-07).
  router.post(
    "/users/:id/reset-code",
    validate({ params: z.object({ id: objectId }) }),
    wrap(async (req, res) => {
      const { code, expiresAt } = await auth.issueResetCode(req.params.id, req.user._id);
      await audit(req, {
        action: "user.reset_code_issued",
        targetType: "users",
        targetId: req.params.id,
      });
      res.status(201).json({ data: { code, expiresAt } });
    }),
  );

  return router;
}
