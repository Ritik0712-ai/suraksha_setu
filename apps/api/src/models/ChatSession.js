import mongoose from "mongoose";
import C from "../config/constants.js";

const { Schema, Types } = mongoose;

export const CHAT_TTL_DAYS = 90;
export const chatExpiry = (from = new Date()) =>
  new Date(from.getTime() + CHAT_TTL_DAYS * 24 * 3600 * 1000);

// docs/05 §5.14 — Sahayak conversations, deleted 90 days after the last message.
const ChatSessionSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: "User", required: true },
    mode: { type: String, enum: C.chatModes, required: true },
    schemeId: { type: Types.ObjectId, ref: "Scheme", default: null },
    letterType: { type: String, enum: [...C.letterTypes, null], default: null },
    title: { type: String, required: true, trim: true, maxlength: 80 },
    messageCount: { type: Number, required: true, default: 0 },
    lastMessageAt: { type: Date, required: true, default: Date.now },
    expireAt: { type: Date, required: true, default: () => chatExpiry() },
  },
  { timestamps: true, collection: "chat_sessions" },
);

ChatSessionSchema.path("schemeId").validate(function (v) {
  return this.mode !== "scheme_help" || Boolean(v);
}, "scheme_required");
ChatSessionSchema.path("letterType").validate(function (v) {
  return this.mode !== "letter" || Boolean(v);
}, "letter_type_required");

ChatSessionSchema.index({ userId: 1, lastMessageAt: -1 });
ChatSessionSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

export const ChatSession =
  mongoose.models.ChatSession || mongoose.model("ChatSession", ChatSessionSchema);
