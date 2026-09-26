import mongoose from "mongoose";
import { logger } from "../lib/logger.js";

export async function connectDb(uri, { production = false } = {}) {
  mongoose.set("strictQuery", true);
  // Indexes are created by `npm run db:indexes` in production (docs/05 §6).
  await mongoose.connect(uri, { autoIndex: !production, serverSelectionTimeoutMS: 10_000 });
  logger.info("MongoDB connected");
  return mongoose.connection;
}

/** "up" | "down" for the health endpoint. */
export function dbStatus() {
  return mongoose.connection.readyState === 1 ? "up" : "down";
}
