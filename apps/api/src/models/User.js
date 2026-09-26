import mongoose from "mongoose";
import C from "../config/constants.js";

const { Schema, Types } = mongoose;

// docs/05 §1.3 EmergencyContact (embedded)
const EmergencyContact = new Schema({
  name: { type: String, required: true, trim: true, minlength: 1, maxlength: 60 },
  relation: { type: String, enum: C.contactRelations, required: true },
  phone: { type: String, required: true },
  email: { type: String, lowercase: true, trim: true },
});

// docs/05 §5.1
const UserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
    phone: { type: String, default: null }, // E.164; null once the account is deleted
    phoneVerified: { type: Boolean, default: false },
    email: { type: String, lowercase: true, trim: true, default: null },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: C.roles, required: true, default: "citizen" },
    status: { type: String, enum: C.userStatus, required: true, default: "active" },
    language: { type: String, enum: C.languages, required: true, default: C.defaultLanguage },
    textSize: { type: String, enum: C.textSizes, required: true, default: C.defaultTextSize },
    gender: { type: String, enum: [...C.genders, null], default: null },
    jurisdictionId: { type: Types.ObjectId, ref: "Jurisdiction", required: true },
    villageOther: { type: String, trim: true, maxlength: 80, default: null },
    emergencyContacts: {
      type: [EmergencyContact],
      default: [],
      validate: {
        validator: (v) => v.length <= C.maxEmergencyContacts,
        message: "too_many_contacts",
      },
    },
    authority: {
      type: new Schema(
        {
          title: { type: String, trim: true, maxlength: 80 },
          jurisdictionIds: [{ type: Types.ObjectId, ref: "Jurisdiction" }],
          departmentId: { type: Types.ObjectId, ref: "Department", default: null },
        },
        { _id: false },
      ),
      default: null,
    },
    mustChangePassword: { type: Boolean, default: false },
    tokenVersion: { type: Number, required: true, default: 0 },
    failedLoginCount: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
    lastLoginAt: Date,
    consent: {
      type: new Schema(
        {
          version: { type: String, required: true },
          acceptedAt: { type: Date, required: true },
        },
        { _id: false },
      ),
      required: true,
    },
    eligibilityAnswers: { type: Schema.Types.Mixed, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "users" },
);

// docs/05 §1.3: a contact can't be the user's own number, and phones are unique in the list.
UserSchema.path("emergencyContacts").validate(function (list) {
  const phones = list.map((c) => c.phone);
  return !phones.includes(this.phone) && new Set(phones).size === phones.length;
}, "invalid_contacts");

UserSchema.path("authority").validate(function (v) {
  if (this.role !== "authority") return true;
  return Boolean(v && v.jurisdictionIds?.length);
}, "authority_requires_jurisdictions");

UserSchema.index(
  { phone: 1 },
  { unique: true, partialFilterExpression: { phone: { $type: "string" } } },
);
UserSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: "string" } } },
);
UserSchema.index({ role: 1, status: 1 });
UserSchema.index({ "authority.jurisdictionIds": 1, "authority.departmentId": 1 });
UserSchema.index({ jurisdictionId: 1 });

/** Shape returned to the user themself (GET /auth/me). Never includes secrets or counters. */
UserSchema.methods.toSelfJSON = function () {
  return {
    id: String(this._id),
    name: this.name,
    phone: this.phone,
    email: this.email,
    role: this.role,
    status: this.status,
    language: this.language,
    textSize: this.textSize,
    gender: this.gender,
    jurisdictionId: this.jurisdictionId ? String(this.jurisdictionId) : null,
    villageOther: this.villageOther,
    emergencyContactCount: this.emergencyContacts?.length ?? 0,
    authority: this.authority
      ? {
          title: this.authority.title ?? null,
          jurisdictionIds: (this.authority.jurisdictionIds ?? []).map(String),
          departmentId: this.authority.departmentId ? String(this.authority.departmentId) : null,
        }
      : null,
    mustChangePassword: this.mustChangePassword,
    createdAt: this.createdAt,
  };
};

export const User = mongoose.models.User || mongoose.model("User", UserSchema);
