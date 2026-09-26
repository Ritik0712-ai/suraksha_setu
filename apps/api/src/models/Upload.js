import mongoose from "mongoose";
import C from "../config/constants.js";
import { AiSuggestion } from "./Complaint.js";

const { Schema, Types } = mongoose;

// docs/05 §5.7 — photos uploaded but not yet attached. The AI suggestion lives here so the
// client can't forge it; it is copied into the complaint on create.
const UploadSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: "User", required: true },
    purpose: { type: String, enum: C.uploadPurposes, required: true },
    imageUrl: { type: String, required: true },
    publicId: { type: String, required: true },
    bytes: Number,
    width: Number,
    height: Number,
    aiSuggestion: { type: AiSuggestion, default: null },
    status: { type: String, enum: C.uploadStatus, required: true, default: "pending" },
    attachedTo: { type: Types.ObjectId, ref: "Complaint", default: null },
  },
  { timestamps: true, collection: "uploads" },
);

UploadSchema.index({ userId: 1, status: 1 });
UploadSchema.index({ status: 1, createdAt: 1 }); // hourly cleanup of pending > 24 h

export const Upload = mongoose.models.Upload || mongoose.model("Upload", UploadSchema);
