import mongoose from "mongoose";
import C from "../config/constants.js";
import { GeoPoint } from "./common.js";

const { Schema, Types } = mongoose;

export const MAX_LOCATION_HISTORY = 720; // push with $slice: -720

// docs/05 §1.3 LocationPoint
const LocationPoint = new Schema(
  {
    point: { type: GeoPoint, required: true },
    accuracyM: Number,
    at: { type: Date, required: true },
  },
  { _id: false },
);

const ContactSnapshot = new Schema(
  {
    name: { type: String, required: true },
    relation: { type: String, enum: C.contactRelations, required: true },
    phone: { type: String, required: true },
    email: { type: String, default: null },
  },
  { _id: false },
);

// docs/05 §5.10
const SosAlertSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: C.sosStatus, required: true, default: "ACTIVE" },
    startLocation: { type: GeoPoint, required: true },
    lastLocation: { type: GeoPoint, required: true },
    lastAccuracyM: Number,
    locationSource: { type: String, enum: C.sosLocationSource, required: true },
    locationHistory: {
      type: [LocationPoint],
      default: [],
      validate: {
        validator: (v) => v.length <= MAX_LOCATION_HISTORY,
        message: "location_history_max",
      },
    },
    jurisdictionId: { type: Types.ObjectId, ref: "Jurisdiction", required: true },
    jurisdictionAncestors: {
      type: [{ type: Types.ObjectId, ref: "Jurisdiction" }],
      validate: { validator: (v) => v.length > 0, message: "ancestors_required" },
    },
    contactsSnapshot: { type: [ContactSnapshot], default: [] },
    emailedTo: { type: [String], default: [] },
    trackTokenHash: { type: String, required: true },
    trackTokenExpiresAt: { type: Date, required: true },
    acknowledgedBy: { type: Types.ObjectId, ref: "User", default: null },
    acknowledgedAt: Date,
    closedBy: { type: Types.ObjectId, ref: "User", default: null },
    closeOutcome: { type: String, enum: [...C.sosCloseOutcomes, null], default: null },
    closeNote: { type: String, trim: true, maxlength: 500 },
    resolvedAt: Date,
    triggeredAt: { type: Date, required: true },
    lastUpdateAt: { type: Date, required: true },
    flaggedForReview: { type: Boolean, default: false },
    createdVia: { type: String, enum: C.sosCreatedVia, required: true, default: "online" },
  },
  { timestamps: true, collection: "sos_alerts" },
);

SosAlertSchema.index({ userId: 1, status: 1 });
SosAlertSchema.index({ jurisdictionAncestors: 1, status: 1, triggeredAt: -1 });
SosAlertSchema.index({ trackTokenHash: 1 }, { unique: true });
SosAlertSchema.index({ status: 1, lastUpdateAt: 1 });
SosAlertSchema.index({ lastLocation: "2dsphere" });
// Only one open SOS per user (docs/05 §5.10), enforced by the database as the final guard.
SosAlertSchema.index(
  { userId: 1 },
  {
    unique: true,
    name: "one_open_sos_per_user",
    partialFilterExpression: { status: { $in: C.sosOpenStatus } },
  },
);

export const SosAlert = mongoose.models.SosAlert || mongoose.model("SosAlert", SosAlertSchema);
