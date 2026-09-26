import mongoose from "mongoose";
import C from "../config/constants.js";

const { Schema, Types } = mongoose;

// docs/05 §5.17 — insert-only record of every authority/admin write action.
const AuditLogSchema = new Schema(
  {
    actorId: { type: Types.ObjectId, ref: "User", required: true },
    actorRole: { type: String, enum: C.roles, required: true },
    action: { type: String, required: true },
    targetType: { type: String, required: true },
    targetId: { type: Types.ObjectId, required: true },
    changes: { type: Schema.Types.Mixed },
    ipPrefix: String,
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "audit_logs" },
);

AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ actorId: 1, createdAt: -1 });
AuditLogSchema.index({ targetType: 1, targetId: 1 });

export const AuditLog = mongoose.models.AuditLog || mongoose.model("AuditLog", AuditLogSchema);
