import mongoose from "mongoose";
import C from "../config/constants.js";

const { Schema, Types } = mongoose;

export const RESET_MAX_ATTEMPTS = 5;
export const RESET_TTL_MS = 30 * 60 * 1000;

// docs/05 §5.3 — email reset tokens and admin-issued codes (single use, 30 minutes).
const PasswordResetSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: "User", required: true },
    kind: { type: String, enum: C.passwordResetKinds, required: true },
    secretHash: { type: String, required: true },
    issuedBy: { type: Types.ObjectId, ref: "User", default: null },
    attempts: { type: Number, default: 0 },
    usedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true, collection: "password_resets" },
);

PasswordResetSchema.index({ userId: 1, kind: 1 });
PasswordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PasswordReset =
  mongoose.models.PasswordReset || mongoose.model("PasswordReset", PasswordResetSchema);
