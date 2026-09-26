import mongoose from "mongoose";
import C from "../config/constants.js";
import { GeoPoint, LocalizedText } from "./common.js";

const { Schema, Types } = mongoose;

// docs/05 §5.13 — curated directory. National helplines live in shared/constants.json instead.
const EmergencyServiceSchema = new Schema(
  {
    name: { type: LocalizedText, required: true },
    type: { type: String, enum: C.serviceTypes, required: true },
    address: { type: LocalizedText, required: true },
    phones: {
      type: [{ type: String, trim: true, match: /^\+?[\d\s-]{3,20}$/ }],
      validate: { validator: (v) => v.length >= 1, message: "phone_required" },
    },
    location: { type: GeoPoint, required: true },
    jurisdictionId: { type: Types.ObjectId, ref: "Jurisdiction", required: true },
    is24x7: Boolean,
    notes: { type: LocalizedText },
    verifiedAt: { type: Date, required: true }, // set only after calling or visiting
    verifiedBy: { type: Types.ObjectId, ref: "User", required: true },
    active: { type: Boolean, required: true, default: true },
  },
  { timestamps: true, collection: "emergency_services" },
);

EmergencyServiceSchema.index({ location: "2dsphere", type: 1, active: 1 });
EmergencyServiceSchema.index({ jurisdictionId: 1 });

export const EmergencyService =
  mongoose.models.EmergencyService || mongoose.model("EmergencyService", EmergencyServiceSchema);
