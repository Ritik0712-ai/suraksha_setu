import mongoose from "mongoose";
import C from "../config/constants.js";

const { Schema, Types } = mongoose;

// "Was this helpful? 👍👎" on Sahayak replies and scheme pages — pilot data for the usability
// report (docs/01 §9). One vote per person per item; tapping the other thumb changes it. No
// free text, so nothing personal is ever stored here.
const FeedbackSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: "User", required: true },
    target: { type: String, enum: C.feedbackTargets, required: true },
    targetId: { type: Types.ObjectId, required: true },
    helpful: { type: Boolean, required: true },
    jurisdictionId: { type: Types.ObjectId, ref: "Jurisdiction", default: null },
  },
  { timestamps: true, collection: "feedback" },
);

FeedbackSchema.index({ userId: 1, target: 1, targetId: 1 }, { unique: true });
FeedbackSchema.index({ target: 1, updatedAt: -1 });

export const Feedback = mongoose.models.Feedback || mongoose.model("Feedback", FeedbackSchema);
