import mongoose from "mongoose";
import { loadEnv } from "../config/env.js";

/** Connects to MONGODB_URI, runs fn, disconnects. Shared by the db:* scripts. */
export async function run(name, fn) {
  const env = loadEnv();
  if (!env.MONGODB_URI) {
    console.error(`${name}: MONGODB_URI is not set (put it in apps/api/.env)`);
    process.exit(1);
  }
  try {
    await mongoose.connect(env.MONGODB_URI, { autoIndex: false });
    await fn(env);
  } catch (err) {
    console.error(`${name} failed:`, err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}
