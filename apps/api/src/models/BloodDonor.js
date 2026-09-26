import mongoose from "mongoose";
import C from "../config/constants.js";
import { GeoPoint } from "./common.js";

const { Schema, Types } = mongoose;

export const DONATION_GAP_DAYS = 90; // docs/01 FR-BLD-03
const DAY_MS = 24 * 3600 * 1000;

/** "Rahul Sharma" → "Rahul S.", "सुनीता देवी" → "सुनीता द." (no full names in search, docs/05 §5.11). */
export function displayNameFrom(fullName) {
  const parts = String(fullName ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${Array.from(parts[parts.length - 1])[0]}.`;
}

// docs/05 §5.11
const BloodDonorSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: "User", required: true },
    bloodGroup: { type: String, enum: C.bloodGroups, required: true },
    lastDonatedAt: {
      type: Date,
      default: null,
      validate: { validator: (v) => !v || v <= new Date(), message: "future_date" },
    },
    eligibleFrom: { type: Date, required: true },
    available: { type: Boolean, required: true, default: true },
    location: { type: GeoPoint, required: true },
    jurisdictionId: { type: Types.ObjectId, ref: "Jurisdiction", required: true },
    displayName: { type: String, required: true, trim: true },
    consentAt: { type: Date, required: true },
  },
  { timestamps: true, collection: "blood_donors" },
);

// eligibleFrom = lastDonatedAt + 90 days, or now if they have never donated.
BloodDonorSchema.pre("validate", function () {
  if (this.isNew || this.isModified("lastDonatedAt") || !this.eligibleFrom) {
    this.eligibleFrom = this.lastDonatedAt
      ? new Date(this.lastDonatedAt.getTime() + DONATION_GAP_DAYS * DAY_MS)
      : (this.createdAt ?? new Date());
  }
});

BloodDonorSchema.index({ userId: 1 }, { unique: true });
BloodDonorSchema.index({ location: "2dsphere", bloodGroup: 1, available: 1, eligibleFrom: 1 });

export const BloodDonor =
  mongoose.models.BloodDonor || mongoose.model("BloodDonor", BloodDonorSchema);
