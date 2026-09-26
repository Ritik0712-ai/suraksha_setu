import mongoose from "mongoose";
import C from "../config/constants.js";
import { LocalizedText } from "./common.js";

const { Schema, Types } = mongoose;

const ANSWER_FIELDS = Object.keys(C.eligibilityAnswers).filter(
  (k) => k !== "$comment" && k !== "unknownValues",
);

// docs/05 §5.8.2 — one machine-checkable condition.
const Condition = new Schema(
  {
    field: { type: String, enum: ANSWER_FIELDS, required: true },
    op: { type: String, enum: C.eligibilityOps, required: true },
    value: { type: Schema.Types.Mixed, required: true },
    failReason: { type: LocalizedText, required: true },
    unknownReason: { type: LocalizedText },
  },
  { _id: false },
);

Condition.path("value").validate(function (v) {
  const allowed = C.eligibilityAnswers[this.field] ?? [];
  const list = this.op === "in" || this.op === "nin" ? v : [v];
  return Array.isArray(list) && list.length > 0 && list.every((x) => allowed.includes(x));
}, "invalid_rule_value");

const EligibilityRules = new Schema(
  {
    all: { type: [Condition], default: [] },
    any: { type: [Condition], default: [] },
    alwaysCheck: { type: [LocalizedText], default: [] },
  },
  { _id: false },
);

const SchemeDocument = new Schema(
  {
    key: { type: String, required: true, trim: true, match: /^[a-z0-9_]+$/ },
    label: { type: LocalizedText, required: true },
    icon: { type: String, trim: true },
  },
  { _id: false },
);

const nonEmpty = { validator: (v) => Array.isArray(v) && v.length > 0, message: "required" };

// docs/05 §5.8 — government scheme catalogue (bilingual).
const SchemeSchema = new Schema(
  {
    slug: { type: String, required: true, trim: true, match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/ },
    name: { type: LocalizedText, required: true },
    summary: { type: LocalizedText, required: true },
    benefitShort: { type: LocalizedText, required: true },
    benefits: { type: [LocalizedText], validate: nonEmpty },
    eligibilityText: { type: [LocalizedText], validate: nonEmpty },
    rules: { type: EligibilityRules, default: null }, // absent → checker answers "maybe"
    documents: { type: [SchemeDocument], validate: nonEmpty },
    howToApply: { type: [LocalizedText], validate: nonEmpty },
    whereToApply: { type: [LocalizedText], validate: nonEmpty },
    officialUrl: { type: String, required: true, match: /^https:\/\/\S+$/ },
    sourceName: { type: String, required: true, trim: true },
    helpline: { type: String, trim: true },
    categories: {
      type: [{ type: String, enum: C.schemeCategories }],
      validate: nonEmpty,
    },
    level: { type: String, enum: C.schemeLevels, required: true },
    state: { type: String, trim: true },
    tags: { type: [String], default: [] },
    status: { type: String, enum: C.schemeStatus, required: true, default: "draft" },
    publishedAt: Date,
    // A scheme can only be published once it has been verified against the official source.
    lastVerifiedAt: {
      type: Date,
      required: [
        function () {
          return this.status === "published";
        },
        "verification_required_to_publish",
      ],
    },
    verifiedBy: { type: Types.ObjectId, ref: "User" },
    createdBy: { type: Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Types.ObjectId, ref: "User", required: true },
    version: { type: Number, required: true, default: 0 },
  },
  { timestamps: true, collection: "schemes" },
);

SchemeSchema.index({ slug: 1 }, { unique: true });
SchemeSchema.index({ status: 1, categories: 1 });
SchemeSchema.index({ lastVerifiedAt: 1 });

export const Scheme = mongoose.models.Scheme || mongoose.model("Scheme", SchemeSchema);
