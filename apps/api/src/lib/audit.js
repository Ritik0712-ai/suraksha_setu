import { AuditLog } from "../models/AuditLog.js";
import { ipPrefix } from "./request.js";

/** Insert-only audit record for every authority/admin write (docs/02 SEC-15, docs/05 §5.17). */
export function audit(req, { action, targetType, targetId, changes }) {
  return AuditLog.create({
    actorId: req.user._id,
    actorRole: req.user.role,
    action,
    targetType,
    targetId,
    changes,
    ipPrefix: ipPrefix(req.ip),
  });
}
