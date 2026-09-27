// Starts the API for the end-to-end tests (docs/06 Phase 6): an in-memory MongoDB replica set,
// the pilot seed data, three known accounts and published schemes, then `node src/server.js`.
// Playwright starts this file (playwright.config.js → webServer) and stops it after the run.
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import C from "../apps/api/src/config/constants.js";
import { hashPassword } from "../apps/api/src/lib/password.js";
import "../apps/api/src/models/index.js";
import { Jurisdiction } from "../apps/api/src/models/Jurisdiction.js";
import { Scheme } from "../apps/api/src/models/Scheme.js";
import { User } from "../apps/api/src/models/User.js";
import { seedDepartments } from "../apps/api/src/scripts/seedDepartments.js";
import { seedJurisdictionTree } from "../apps/api/src/scripts/seedJurisdictions.js";
import { seedSchemes } from "../apps/api/src/scripts/seedSchemes.js";
import { ACCOUNTS, API_PORT, AI_PORT, INTERNAL_KEY, PASSWORD } from "./accounts.js";

const seed = async (name) =>
  JSON.parse(await readFile(new URL(`../apps/api/seed/${name}`, import.meta.url), "utf8"));

const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
const uri = replSet.getUri("suraksha_e2e");
await mongoose.connect(uri);
await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));

await seedJurisdictionTree((await seed("jurisdictions.json")).tree);
await seedDepartments(await seed("departments.json"));
const village = await Jurisdiction.findOne({ type: "village" }).lean();
const gp = await Jurisdiction.findOne({ type: "gram_panchayat" }).lean();

const passwordHash = await hashPassword(PASSWORD, 4);
const consent = { version: C.consentVersion, acceptedAt: new Date() };
const admin = await User.create({
  ...ACCOUNTS.admin,
  passwordHash,
  role: "admin",
  jurisdictionId: village._id,
  consent,
});
await User.create({
  ...ACCOUNTS.authority,
  passwordHash,
  role: "authority",
  jurisdictionId: village._id,
  authority: { jurisdictionIds: [gp._id], departmentId: null },
  consent,
});
await User.create({
  ...ACCOUNTS.citizen,
  passwordHash,
  role: "citizen",
  jurisdictionId: village._id,
  consent,
  emergencyContacts: [{ name: "Ramesh", relation: "husband", phone: "+919812300000" }],
});

// Schemes are drafts until verified; the E2E catalogue publishes them so screens have data.
await seedSchemes(await seed("schemes.json"));
await Scheme.updateMany(
  {},
  {
    status: "published",
    publishedAt: new Date(),
    lastVerifiedAt: new Date(),
    verifiedBy: admin._id,
  },
);
await mongoose.disconnect();

const api = spawn(process.execPath, ["apps/api/src/server.js"], {
  cwd: new URL("..", import.meta.url).pathname,
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV: "development",
    PORT: String(API_PORT),
    MONGODB_URI: uri,
    JWT_ACCESS_SECRET: "e2e-access-secret",
    REFRESH_TOKEN_PEPPER: "e2e-pepper",
    BCRYPT_COST: "4",
    CORS_ORIGINS: "http://localhost:4173",
    PUBLIC_APP_URL: "http://localhost:4173",
    API_PUBLIC_URL: `http://localhost:${API_PORT}`,
    AI_BASE_URL: `http://127.0.0.1:${AI_PORT}`,
    AI_INTERNAL_KEY: INTERNAL_KEY,
    LOG_LEVEL: "warn",
  },
});

// The AI service with the 2 KB test model (red photo → road damage) and the offline "fake" LLM,
// grounded on the same database. If Python/Django isn't installed, the app's AI fallbacks run.
const python = process.env.E2E_PYTHON || "python3";
const ai = spawn(python, ["manage.py", "runserver", String(AI_PORT), "--noreload"], {
  cwd: new URL("../apps/ai", import.meta.url).pathname,
  stdio: "inherit",
  env: {
    ...process.env,
    DJANGO_DEBUG: "true",
    AI_INTERNAL_KEY: INTERNAL_KEY,
    LLM_PROVIDER: "fake",
    MONGODB_URI_READONLY: uri,
    MODEL_PATH: new URL("../apps/ai/core/tests/fixtures/test_model.tflite", import.meta.url)
      .pathname,
    AI_ALLOWED_IMAGE_HOSTS: "localhost,127.0.0.1",
  },
});
ai.on("error", (err) =>
  console.warn(`AI service not started (${err.message}) — AI fallbacks only`),
);

const stop = async () => {
  ai.kill("SIGTERM");
  api.kill("SIGTERM");
  await replSet.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
api.on("exit", (code) => {
  console.error(`API exited (${code})`);
  replSet.stop().finally(() => process.exit(code ?? 1));
});
