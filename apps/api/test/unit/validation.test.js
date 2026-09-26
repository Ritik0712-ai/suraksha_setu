import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { loadEnv } from "../../src/config/env.js";

// These requests fail validation before touching the database, so no DB is needed.
const app = createApp({ env: loadEnv({ NODE_ENV: "test" }), mailer: { send: async () => true } });

describe("request validation + localised errors (docs/02 §7.1)", () => {
  it("rejects a bad registration with per-field issues, in Hindi by default", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ name: "S", phone: "12345", password: "12345678", consent: false });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.message).toBe("कृपया चिह्नित जानकारी जाँचें।");
    const issues = Object.fromEntries(res.body.error.details.map((d) => [d.field, d.issue]));
    expect(issues).toMatchObject({
      name: "too_short",
      phone: "invalid_phone",
      password: "only_digits",
      consent: "consent_required",
    });
  });

  it("asks for a village when neither jurisdictionId nor villageOther is given", async () => {
    const res = await request(app).post("/api/v1/auth/register").send({
      name: "Sunita Devi",
      phone: "9876543210",
      password: "abcd1234",
      consent: true,
    });
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([{ field: "jurisdictionId", issue: "required" }]);
  });

  it("answers in English when asked", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .set("Accept-Language", "en-IN,en;q=0.9")
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe("Please check the highlighted fields.");
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([
        { field: "phone", issue: "required" },
        { field: "password", issue: "required" },
      ]),
    );
  });

  it("requires a token for protected routes", async () => {
    const res = await request(app).get("/api/v1/auth/me").set("Accept-Language", "en");
    expect(res.status).toBe(401);
    expect(res.body.error).toEqual({ code: "UNAUTHENTICATED", message: "Please log in again." });
  });

  it("strips $-operators from bodies (NoSQL injection)", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ phone: { $gt: "" }, password: { $ne: null } });
    expect(res.status).toBe(400);
  });

  it("rejects an invalid reset body", async () => {
    const res = await request(app)
      .post("/api/v1/auth/password/reset")
      .send({ phone: "9876543210", code: "12ab", password: "abcd1234" });
    expect(res.status).toBe(400);
  });
});
