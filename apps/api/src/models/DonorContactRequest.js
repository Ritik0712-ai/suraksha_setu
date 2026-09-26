import mongoose from "mongoose";
import C from "../config/constants.js";

const { Schema, Types } = mongoose;

export const DONOR_REVEALS_PER_DAY = 10; // docs/01 FR-BLD-04

// docs/05 §5.12 — log of donor phone reveals (abuse prevention), kept 180 days.
const DonorContactRequestSchema = new Schema(
  {
    requesterId: { type: Types.ObjectId, ref: "User", required: true },
    donorId: { type: Types.ObjectId, ref: "BloodDonor", required: true },
    bloodGroupSearched: { type: String, enum: C.bloodGroups, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "donor_contact_requests" },
);

DonorContactRequestSchema.index({ requesterId: 1, createdAt: -1 });
DonorContactRequestSchema.index({ donorId: 1, createdAt: -1 });
DonorContactRequestSchema.index({ createdAt: 1 }, { expireAfterSeconds: 180 * 24 * 3600 });

export const DonorContactRequest =
  mongoose.models.DonorContactRequest ||
  mongoose.model("DonorContactRequest", DonorContactRequestSchema);
