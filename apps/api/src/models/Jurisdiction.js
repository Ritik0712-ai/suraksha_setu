import mongoose from "mongoose";
import C from "../config/constants.js";
import { GeoPoint, LocalizedText } from "./common.js";

const { Schema, Types } = mongoose;

// docs/05 §5.4 — state → district → block → gram panchayat → village.
const JurisdictionSchema = new Schema(
  {
    name: { type: LocalizedText, required: true },
    type: { type: String, enum: C.jurisdictionTypes, required: true },
    parentId: { type: Types.ObjectId, ref: "Jurisdiction", default: null },
    ancestors: [{ type: Types.ObjectId, ref: "Jurisdiction" }],
    lgdCode: String,
    centroid: { type: GeoPoint, required: true },
    boundary: { type: Schema.Types.Mixed, default: undefined }, // GeoJSON Polygon/MultiPolygon
    defaultDepartmentId: { type: Types.ObjectId, ref: "Department", default: null },
    active: { type: Boolean, required: true, default: true },
  },
  { timestamps: true, collection: "jurisdictions" },
);

// Keep `ancestors` (root first) in sync with parentId (docs/05 §5.4, §12).
JurisdictionSchema.pre("validate", async function () {
  if (!this.isNew && !this.isModified("parentId")) return;
  if (!this.parentId) {
    this.ancestors = [];
    return;
  }
  const parent = await this.constructor.findById(this.parentId).select("ancestors").lean();
  if (!parent) throw new Error("parent_not_found");
  this.ancestors = [...parent.ancestors, parent._id];
});

JurisdictionSchema.index({ parentId: 1 });
JurisdictionSchema.index({ ancestors: 1 });
JurisdictionSchema.index({ type: 1 });
JurisdictionSchema.index({ centroid: "2dsphere" });
JurisdictionSchema.index({ boundary: "2dsphere" }, { sparse: true });

/** [self, parent, ..., root] — the order stored in complaints/SOS `jurisdictionAncestors`. */
JurisdictionSchema.methods.selfAndAncestors = function () {
  return [this._id, ...[...this.ancestors].reverse()];
};

export const Jurisdiction =
  mongoose.models.Jurisdiction || mongoose.model("Jurisdiction", JurisdictionSchema);
