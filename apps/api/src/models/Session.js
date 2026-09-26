import mongoose from "mongoose";

const { Schema, Types } = mongoose;

// docs/05 §5.2 — refresh-token sessions, rotated on every use.
const SessionSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: "User", required: true },
    tokenHash: { type: String, required: true },
    familyId: { type: String, required: true },
    replacedBy: { type: Types.ObjectId, default: null },
    revokedAt: { type: Date, default: null },
    userAgent: { type: String, maxlength: 200 },
    ipPrefix: String,
    lastUsedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true, collection: "sessions" },
);

SessionSchema.index({ tokenHash: 1 }, { unique: true });
SessionSchema.index({ userId: 1 });
SessionSchema.index({ familyId: 1 });
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Session = mongoose.models.Session || mongoose.model("Session", SessionSchema);
