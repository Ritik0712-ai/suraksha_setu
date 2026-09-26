import { Router } from "express";
import { z } from "zod";
import { audit } from "../../lib/audit.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { objectId } from "../auth/schemas.js";
import { adminSchemesRouter } from "../schemes/admin.js";
import { adminEmergencyRouter } from "../emergency/admin.js";
import { adminManageRouters } from "./manage.js";
import { dashboardRouter } from "./overview.js";

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

/** /api/v1/admin/* (docs/02 §7.2 "Authority / Admin (M6)"). */
export function adminRouter({ env, auth, realtime }) {
  const router = Router();
  router.use(requireAuth(env));

  // Authority + admin (scoped): A-01 overview, A-06 analytics.
  router.use(requireRole("authority", "admin"), dashboardRouter());

  // Admin only from here on.
  router.use(requireRole("admin"));
  const manage = adminManageRouters({ bcryptCost: env.BCRYPT_COST });
  router.use("/users", manage.users);
  router.use("/departments", manage.departments);
  router.use("/jurisdictions", manage.jurisdictions);
  router.use("/audit-logs", manage.audit);
  router.use("/schemes", adminSchemesRouter({ realtime }));
  router.use("/emergency-services", adminEmergencyRouter());

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
