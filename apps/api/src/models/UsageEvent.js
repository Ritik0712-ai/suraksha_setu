import mongoose from "mongoose";
import C from "../config/constants.js";

const { Schema, Types } = mongoose;

// docs/05 §5.18 — product metrics for the PRD success metrics. props must never contain free
// text or questionnaire answers.
const UsageEventSchema = new Schema(
  {
    type: { type: String, enum: C.usageEventTypes, required: true },
    userId: { type: Types.ObjectId, ref: "User", default: null },
    anonId: { type: String, maxlength: 64 },
    jurisdictionId: { type: Types.ObjectId, ref: "Jurisdiction", default: null },
    props: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "usage_events" },
);

UsageEventSchema.path("props").validate(
  (v) =>
    Object.values(v ?? {}).every(
      (x) =>
        x === null ||
        ["number", "boolean"].includes(typeof x) ||
        (typeof x === "string" && x.length <= 40),
    ),
  "props_must_be_short_scalars",
);

UsageEventSchema.index({ type: 1, createdAt: -1 });
UsageEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 3600 });

export const UsageEvent =
  mongoose.models.UsageEvent || mongoose.model("UsageEvent", UsageEventSchema);
