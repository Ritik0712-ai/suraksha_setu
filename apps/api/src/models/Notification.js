import mongoose from "mongoose";
import C from "../config/constants.js";

const { Schema, Types } = mongoose;

const TTL_MS = 180 * 24 * 3600 * 1000;

// docs/05 §5.16 — rendered in the reader's current language from templateKey + params.
const NotificationSchema = new Schema(
  {
    recipientId: { type: Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: C.notificationTypes, required: true },
    templateKey: { type: String, required: true },
    params: { type: Schema.Types.Mixed, default: {} },
    link: String,
    readAt: { type: Date, default: null },
    expireAt: { type: Date, required: true, default: () => new Date(Date.now() + TTL_MS) },
  },
  { timestamps: true, collection: "notifications" },
);

NotificationSchema.index({ recipientId: 1, readAt: 1, createdAt: -1 });
NotificationSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

export const Notification =
  mongoose.models.Notification || mongoose.model("Notification", NotificationSchema);
