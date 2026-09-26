import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { loadEnv } from "../../src/config/env.js";

const baseEnv = { NODE_ENV: "test" };

describe("GET /api/v1/health", () => {
  it("reports db down and ai unconfigured without a database or AI service", async () => {
    const app = createApp({ env: loadEnv(baseEnv) });
    const res = await request(app).get("/api/v1/health");
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: "degraded", db: "down", ai: "unconfigured" });
  });

  it("sends the internal key to the AI service and reports it up", async () => {
    let seen;
    const fetchImpl = async (url, opts) => {
      seen = { url, key: opts.headers["X-Internal-Key"] };
      return { ok: true };
    };
    const env = loadEnv({ ...baseEnv, AI_BASE_URL: "http://ai", AI_INTERNAL_KEY: "k" });
    const res = await request(createApp({ env, fetchImpl })).get("/api/v1/health");
    expect(res.body.ai).toBe("up");
    expect(seen).toEqual({ url: "http://ai/internal/health", key: "k" });
  });

  it("reports the AI service down when it can't be reached", async () => {
    const fetchImpl = async () => {
      throw new Error("ECONNREFUSED");
    };
    const env = loadEnv({ ...baseEnv, AI_BASE_URL: "http://ai" });
    const res = await request(createApp({ env, fetchImpl })).get("/api/v1/health");
    expect(res.body.ai).toBe("down");
  });
});

describe("error envelope", () => {
  const app = createApp({ env: loadEnv(baseEnv) });

  it("returns NOT_FOUND for unknown routes", async () => {
    const res = await request(app).get("/api/v1/nope");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("returns VALIDATION_ERROR for malformed JSON", async () => {
    const res = await request(app)
      .post("/api/v1/health")
      .set("Content-Type", "application/json")
      .send("{bad");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("loadEnv", () => {
  it("parses CORS_ORIGINS into a list", () => {
    const env = loadEnv({ CORS_ORIGINS: "https://a.app, https://b.app" });
    expect(env.CORS_ORIGINS).toEqual(["https://a.app", "https://b.app"]);
  });

  it("refuses to start in production without secrets", () => {
    expect(() => loadEnv({ NODE_ENV: "production" })).toThrow(/MONGODB_URI/);
  });
});
