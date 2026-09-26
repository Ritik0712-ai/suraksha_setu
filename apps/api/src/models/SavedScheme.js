import mongoose from "mongoose";

const { Schema, Types } = mongoose;

// docs/05 §5.9 — bookmarks + document checklist.
const SavedSchemeSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: "User", required: true },
    schemeId: { type: Types.ObjectId, ref: "Scheme", required: true },
    checkedDocuments: { type: [String], default: [] },
    seenVersion: { type: Number, required: true, default: 0 },
  },
  { timestamps: true, collection: "saved_schemes" },
);

SavedSchemeSchema.index({ userId: 1, schemeId: 1 }, { unique: true });
SavedSchemeSchema.index({ schemeId: 1 });

export const SavedScheme =
  mongoose.models.SavedScheme || mongoose.model("SavedScheme", SavedSchemeSchema);
