import mongoose from "mongoose";
import C from "../config/constants.js";
import { GeoPoint } from "./common.js";

const { Schema, Types } = mongoose;

// docs/05 §1.3 TimelineEvent (embedded, append-only)
const TimelineEvent = new Schema({
  type: { type: String, enum: C.timelineTypes, required: true },
  fromStatus: { type: String, enum: C.complaintStatus },
  toStatus: { type: String, enum: C.complaintStatus },
  text: { type: String, maxlength: 1000, trim: true },
  visibility: { type: String, enum: C.timelineVisibility, required: true },
  actorId: { type: Types.ObjectId, ref: "User", default: null },
  actorRole: { type: String, enum: C.actorRoles, required: true },
  meta: Schema.Types.Mixed,
  at: { type: Date, required: true, default: Date.now },
});

// Same shape in complaints and uploads (docs/05 §5.6, §5.7).
export const AiSuggestion = new Schema(
  {
    category: { type: String, enum: C.complaintCategories, required: true },
    confidence: { type: Number, min: 0, max: 1, required: true },
    top3: {
      type: [
        new Schema(
          {
            category: { type: String, enum: C.complaintCategories },
            confidence: { type: Number, min: 0, max: 1 },
          },
          { _id: false },
        ),
      ],
      validate: { validator: (v) => v.length <= 3, message: "top3_max_3" },
    },
    modelVersion: { type: String, required: true },
    inferenceMs: Number,
  },
  { _id: false },
);

export const MAX_TIMELINE_EVENTS = 200;
export const MAX_REOPENS = 2;

// docs/05 §5.6
const ComplaintSchema = new Schema(
  {
    complaintNo: { type: String, required: true, match: /^SS-\d{4}-\d{6}$/ },
    citizenId: { type: Types.ObjectId, ref: "User", default: null }, // null once account deleted
    onBehalfOf: {
      type: new Schema(
        { name: { type: String, trim: true, maxlength: 60, required: true }, phone: String },
        { _id: false },
      ),
      default: null,
    },
    category: { type: String, enum: C.complaintCategories, required: true },
    categorySource: { type: String, enum: C.categorySource, required: true },
    aiSuggestion: { type: AiSuggestion, default: null },
    description: { type: String, maxlength: 500, trim: true },
    landmark: { type: String, maxlength: 100, trim: true },
    // "Me too": other citizens who have the same problem here. Ids are never sent to anyone.
    supporters: { type: [{ type: Types.ObjectId, ref: "User" }], default: [], select: false },
    supporterCount: { type: Number, default: 0, min: 0 },
    location: { type: GeoPoint, required: true },
    locationAccuracyM: Number,
    jurisdictionId: { type: Types.ObjectId, ref: "Jurisdiction", required: true },
    jurisdictionAncestors: {
      type: [{ type: Types.ObjectId, ref: "Jurisdiction" }],
      validate: { validator: (v) => v.length > 0, message: "ancestors_required" },
    },
    departmentId: { type: Types.ObjectId, ref: "Department", required: true },
    assigneeId: { type: Types.ObjectId, ref: "User", default: null },
    status: { type: String, enum: C.complaintStatus, required: true, default: "SUBMITTED" },
    statusChangedAt: { type: Date, required: true, default: Date.now },
    imageUrl: String,
    imagePublicId: String,
    resolutionImageUrl: String,
    resolutionImagePublicId: String,
    rejection: {
      type: new Schema(
        {
          code: { type: String, enum: C.rejectionReasons, required: true },
          text: { type: String, trim: true, maxlength: 300 },
        },
        { _id: false },
      ),
      default: null,
    },
    reopenCount: { type: Number, required: true, default: 0, min: 0, max: MAX_REOPENS },
    resolvedAt: Date,
    firstActionAt: Date,
    timeline: {
      type: [TimelineEvent],
      validate: {
        validator: (v) => v.length >= 1 && v.length <= MAX_TIMELINE_EVENTS,
        message: "timeline_length",
      },
    },
    supportCount: { type: Number, default: 0 },
  },
  { timestamps: true, collection: "complaints" },
);

ComplaintSchema.index({ complaintNo: 1 }, { unique: true });
ComplaintSchema.index({ citizenId: 1, createdAt: -1 });
ComplaintSchema.index({ jurisdictionAncestors: 1, status: 1, createdAt: -1 });
ComplaintSchema.index({ departmentId: 1, status: 1 });
ComplaintSchema.index({ category: 1, createdAt: -1 });
ComplaintSchema.index({ location: "2dsphere" });
ComplaintSchema.index({ status: 1, statusChangedAt: 1 });

// Citizens only ever see public timeline events (docs/05 §15).
ComplaintSchema.methods.toCitizenJSON = function () {
  const o = this.toObject();
  o.timeline = o.timeline.filter((e) => e.visibility === "public");
  delete o.assigneeId;
  return o;
};

export const Complaint = mongoose.models.Complaint || mongoose.model("Complaint", ComplaintSchema);
