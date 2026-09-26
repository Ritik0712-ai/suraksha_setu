import request from "supertest";
import { createRealtimeRecorder } from "../../src/lib/realtime.js";
import { createMemoryStorage } from "../../src/lib/storage.js";
import { createApp } from "../../src/app.js";
import { loadEnv } from "../../src/config/env.js";
import { Jurisdiction } from "../../src/models/Jurisdiction.js";
import { User } from "../../src/models/User.js";
import { hashPassword } from "../../src/lib/password.js";
import C from "../../src/config/constants.js";
import "../../src/models/Session.js";
import "../../src/models/PasswordReset.js";
import "../../src/models/AuditLog.js";

export const PASSWORD = "safe-pass-123";

export function testEnv(overrides = {}) {
  return loadEnv({
    NODE_ENV: "test",
    JWT_ACCESS_SECRET: "test-access-secret",
    REFRESH_TOKEN_PEPPER: "test-pepper",
    BCRYPT_COST: "4",
    PUBLIC_APP_URL: "https://app.test",
    ...overrides,
  });
}

/** Fake mailer that records every message. */
export function fakeMailer() {
  const sent = [];
  return {
    sent,
    async send(to, subject, text) {
      sent.push({ to, subject, text });
      return true;
    },
  };
}

/**
 * Stand-in for the AI client: set `next` to the suggestion the next classify returns, and
 * `sahayak` to the next Sahayak result ({ ok, reply } or { ok: false, reason }).
 */
export function fakeAi() {
  const ai = {
    configured: true,
    calls: [],
    next: null,
    up: true,
    sahayakCalls: [],
    sahayak: {
      ok: true,
      reply: { intent: "answer", text: "ठीक है", cards: [], chips: [], letter: null, llm: {} },
    },
    async sahayakReply(payload) {
      ai.sahayakCalls.push(payload);
      return typeof ai.sahayak === "function" ? ai.sahayak(payload) : ai.sahayak;
    },
    async classify(imageUrl) {
      ai.calls.push(imageUrl);
      return ai.next;
    },
    async health() {
      return { ok: ai.up, modelVersion: ai.up ? "civic_cnn_test" : null };
    },
  };
  return ai;
}

export function makeApp({
  rateLimits = false,
  env = testEnv(),
  storage = createMemoryStorage(),
  ai = fakeAi(),
} = {}) {
  const mailer = fakeMailer();
  const realtime = createRealtimeRecorder();
  const app = createApp({ env, mailer, realtime, rateLimits, storage, ai });
  return { app, mailer, realtime, env, storage, ai, api: () => request(app) };
}

/** Logs in and returns an authenticated request builder: as("post", "/sos").send(...) */
export async function loginAs(api, phone, password = PASSWORD) {
  const res = await api().post("/api/v1/auth/login").send({ phone, password });
  if (res.status !== 200) throw new Error(`login failed for ${phone}: ${res.status}`);
  const token = res.body.data.accessToken;
  return (method, path) => api()[method](`/api/v1${path}`).set("Authorization", `Bearer ${token}`);
}

/** Minimal pilot tree: MP → Sehore district → Sehore block → Mahodiya GP → Mahodiya village. */
export async function seedJurisdictions() {
  const at = { type: "Point", coordinates: [77.08, 23.2] };
  const make = (en, hi, type, parent) =>
    Jurisdiction.create({ name: { en, hi }, type, parentId: parent?._id ?? null, centroid: at });
  const state = await make("Madhya Pradesh", "मध्य प्रदेश", "state");
  const district = await make("Sehore", "सीहोर", "district", state);
  const block = await make("Sehore", "सीहोर", "block", district);
  const gp = await make("Mahodiya", "महोदिया", "gram_panchayat", block);
  const village = await make("Mahodiya", "महोदिया", "village", gp);
  return { state, district, block, gp, village };
}

export function registerBody(village, overrides = {}) {
  return {
    name: "Sunita Devi",
    phone: "98765 43210",
    password: PASSWORD,
    jurisdictionId: String(village._id),
    consent: true,
    ...overrides,
  };
}

/** Creates a user directly in the DB (for authority/admin accounts). */
export async function createUser({
  role = "citizen",
  phone = "+919812345678",
  password = PASSWORD,
  jurisdictionId,
  ...rest
}) {
  return User.create({
    name: rest.name ?? `${role} user`,
    phone,
    passwordHash: await hashPassword(password, 4),
    role,
    jurisdictionId,
    consent: { version: C.consentVersion, acceptedAt: new Date() },
    ...rest,
  });
}

/** Extracts the ss_rt cookie value and its attributes from a response. */
export function refreshCookie(res) {
  const raw = (res.headers["set-cookie"] || []).find((c) => c.startsWith("ss_rt="));
  if (!raw) return null;
  const [pair, ...attrs] = raw.split(";").map((s) => s.trim());
  return { value: decodeURIComponent(pair.slice("ss_rt=".length)), attrs, raw };
}

export const cookieHeader = (value) => `ss_rt=${encodeURIComponent(value)}`;
