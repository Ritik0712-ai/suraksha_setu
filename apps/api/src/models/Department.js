import mongoose from "mongoose";
import C from "../config/constants.js";
import { LocalizedText } from "./common.js";

const { Schema, Types } = mongoose;

// docs/05 §5.5 — departments per jurisdiction, with the categories they handle (routing).
const DepartmentSchema = new Schema(
  {
    name: { type: LocalizedText, required: true },
    code: { type: String, required: true, trim: true, uppercase: true, match: /^[A-Z0-9_]+$/ },
    jurisdictionId: { type: Types.ObjectId, ref: "Jurisdiction", required: true },
    // Empty = never auto-routed; an authority assigns it manually (e.g. PWD for district roads).
    handlesCategories: { type: [{ type: String, enum: C.complaintCategories }], default: [] },
    contactPhone: String,
    contactEmail: { type: String, lowercase: true, trim: true },
    active: { type: Boolean, required: true, default: true },
  },
  { timestamps: true, collection: "departments" },
);

DepartmentSchema.index({ code: 1 }, { unique: true });
DepartmentSchema.index({ jurisdictionId: 1, handlesCategories: 1 });

export const Department =
  mongoose.models.Department || mongoose.model("Department", DepartmentSchema);
