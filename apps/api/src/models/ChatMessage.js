import mongoose from "mongoose";
import C from "../config/constants.js";

const { Schema, Types } = mongoose;

const Letter = new Schema(
  {
    to: { type: String, required: true },
    subject: { type: String, required: true },
    body: { type: String, required: true },
    place: String,
    date: String,
    applicantName: { type: String, required: true },
    mobile: String,
  },
  { _id: false },
);

// docs/05 §5.15
const ChatMessageSchema = new Schema(
  {
    sessionId: { type: Types.ObjectId, ref: "ChatSession", required: true },
    userId: { type: Types.ObjectId, ref: "User", required: true },
    role: { type: String, enum: C.chatMessageRoles, required: true },
    text: { type: String, required: true, maxlength: 4000 },
    intent: { type: String, enum: [...C.chatIntents, null], default: null },
    cards: {
      type: [
        new Schema(
          { type: { type: String, enum: ["scheme"], required: true }, slug: String },
          { _id: false },
        ),
      ],
      default: undefined,
    },
    letter: { type: Letter, default: null },
    letterEdited: { type: Letter, default: null },
    llm: {
      type: new Schema(
        {
          provider: String,
          model: String,
          tokensIn: Number,
          tokensOut: Number,
          latencyMs: Number,
        },
        { _id: false },
      ),
      default: null,
    },
    expireAt: { type: Date, required: true },
  },
  { timestamps: true, collection: "chat_messages" },
);

ChatMessageSchema.index({ sessionId: 1, createdAt: 1 });
ChatMessageSchema.index({ userId: 1, role: 1, createdAt: -1 }); // daily limit
ChatMessageSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

export const ChatMessage =
  mongoose.models.ChatMessage || mongoose.model("ChatMessage", ChatMessageSchema);
