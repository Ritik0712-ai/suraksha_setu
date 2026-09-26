import { beforeEach, describe, expect, it } from "vitest";
import { useTestDb } from "../helpers/db.js";
import {
  PASSWORD,
  createUser,
  makeApp,
  refreshCookie,
  registerBody,
  seedJurisdictions,
} from "../helpers/app.js";
import { User } from "../../src/models/User.js";
import { Session } from "../../src/models/Session.js";
import C from "../../src/config/constants.js";

useTestDb();

describe("POST /auth/register (docs/03 S-04)", () => {
  let j;
  beforeEach(async () => {
    j = await seedJurisdictions();
  });

  it("creates a citizen, logs them in and stores consent", async () => {
    const { api } = makeApp();
    const res = await api().post("/api/v1/auth/register").send(registerBody(j.village));

    expect(res.status).toBe(201);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.body.data.expiresIn).toBe(900);
    expect(res.body.data.user).toMatchObject({
      name: "Sunita Devi",
      phone: "+919876543210", // normalised from "98765 43210"
      role: "citizen",
      language: "hi",
      jurisdictionId: String(j.village._id),
      mustChangePassword: false,
    });
    expect(res.body.data.user).not.toHaveProperty("passwordHash");

    const cookie = refreshCookie(res);
    expect(cookie.attrs).toEqual(
      expect.arrayContaining(["Path=/api/v1/auth", "HttpOnly", "SameSite=Lax"]),
    );

    const user = await User.findOne({ phone: "+919876543210" }).select("+passwordHash").lean();
    expect(user.passwordHash).toMatch(/^\$2b\$/);
    expect(user.consent.version).toBe(C.consentVersion);
    expect(await Session.countDocuments({ userId: user._id })).toBe(1);
  });

  it("returns 409 phone_taken for a number that's already registered", async () => {
    const { api } = makeApp();
    await api().post("/api/v1/auth/register").send(registerBody(j.village));
    const res = await api()
      .post("/api/v1/auth/register")
      .set("Accept-Language", "en")
      .send(registerBody(j.village, { phone: "+91 9876543210", name: "Someone Else" }));
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({
      code: "CONFLICT",
      message: "This number is already registered.",
      details: [{ field: "phone", issue: "taken" }],
    });
  });

  it("rejects a jurisdiction that isn't an active village", async () => {
    const { api } = makeApp();
    const res = await api()
      .post("/api/v1/auth/register")
      .send(registerBody(j.village, { jurisdictionId: String(j.block._id) }));
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([{ field: "jurisdictionId", issue: "invalid" }]);
  });

  it("puts 'my village is not listed' users in the default district", async () => {
    const { api } = makeApp();
    const res = await api()
      .post("/api/v1/auth/register")
      .send(registerBody(j.village, { jurisdictionId: undefined, villageOther: "Bilkisganj" }));
    expect(res.status).toBe(201);
    expect(res.body.data.user).toMatchObject({
      jurisdictionId: String(j.district._id),
      villageOther: "Bilkisganj",
    });
  });
});

describe("POST /auth/login (docs/03 S-03, docs/05 §7.2)", () => {
  let j;
  beforeEach(async () => {
    j = await seedJurisdictions();
  });

  it("logs in with any phone format and returns tokens", async () => {
    const { api } = makeApp();
    await createUser({ phone: "+919876543210", jurisdictionId: j.village._id });
    const res = await api()
      .post("/api/v1/auth/login")
      .send({ phone: "098765-43210", password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.data.user.phone).toBe("+919876543210");
    expect(refreshCookie(res)).not.toBeNull();
  });

  it("gives the same answer for a wrong password and an unknown number", async () => {
    const { api } = makeApp();
    await createUser({ phone: "+919876543210", jurisdictionId: j.village._id });
    const wrong = await api()
      .post("/api/v1/auth/login")
      .send({ phone: "9876543210", password: "wrong-pass-1" });
    const unknown = await api()
      .post("/api/v1/auth/login")
      .send({ phone: "9123456780", password: "wrong-pass-1" });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body).toEqual(unknown.body);
    expect(wrong.body.error.message).toBe("मोबाइल नंबर या पासवर्ड गलत है।");
  });

  it("locks the account for 30 minutes after 10 failures and emails the user", async () => {
    const { api, mailer } = makeApp();
    await createUser({
      phone: "+919876543210",
      email: "sunita@example.com",
      jurisdictionId: j.village._id,
    });
    for (let i = 0; i < 10; i++) {
      const r = await api()
        .post("/api/v1/auth/login")
        .send({ phone: "9876543210", password: `wrong-pass-${i}` });
      expect(r.status).toBe(401);
    }
    const locked = await api()
      .post("/api/v1/auth/login")
      .send({ phone: "9876543210", password: PASSWORD });
    expect(locked.status).toBe(423);
    expect(locked.body.error.code).toBe("ACCOUNT_LOCKED");

    const user = await User.findOne({ phone: "+919876543210" }).lean();
    const lockMinutes = (user.lockedUntil - Date.now()) / 60000;
    expect(lockMinutes).toBeGreaterThan(29);
    expect(lockMinutes).toBeLessThanOrEqual(30);
    await expect.poll(() => mailer.sent.length).toBe(1);
    expect(mailer.sent[0].to).toBe("sunita@example.com");

    // After the lock expires, the right password works and the counters reset.
    await User.updateOne({ _id: user._id }, { lockedUntil: new Date(Date.now() - 1000) });
    const ok = await api()
      .post("/api/v1/auth/login")
      .send({ phone: "9876543210", password: PASSWORD });
    expect(ok.status).toBe(200);
    const after = await User.findById(user._id).lean();
    expect(after.failedLoginCount).toBe(0);
    expect(after.lockedUntil).toBeNull();
  });

  it("says the account is inactive only after a correct password", async () => {
    const { api } = makeApp();
    await createUser({ phone: "+919876543210", status: "inactive", jurisdictionId: j.village._id });
    const wrong = await api()
      .post("/api/v1/auth/login")
      .send({ phone: "9876543210", password: "wrong-pass-1" });
    expect(wrong.status).toBe(401);
    const right = await api()
      .post("/api/v1/auth/login")
      .set("Accept-Language", "en")
      .send({ phone: "9876543210", password: PASSWORD });
    expect(right.status).toBe(403);
    expect(right.body.error.message).toBe(
      "This account is inactive. Contact the Suraksha Setu team.",
    );
  });

  it("gives citizens 30-day sessions and staff 12-hour sessions", async () => {
    const { api } = makeApp();
    await createUser({ phone: "+919876543210", jurisdictionId: j.village._id });
    await createUser({
      phone: "+919812345678",
      role: "authority",
      jurisdictionId: j.village._id,
      authority: { jurisdictionIds: [j.gp._id] },
    });
    const days = (res) =>
      Number(
        refreshCookie(res)
          .attrs.find((a) => a.startsWith("Max-Age="))
          .slice(8),
      ) / 86400;

    const citizen = await api()
      .post("/api/v1/auth/login")
      .send({ phone: "9876543210", password: PASSWORD });
    const officer = await api()
      .post("/api/v1/auth/login")
      .send({ phone: "9812345678", password: PASSWORD });
    expect(days(citizen)).toBeCloseTo(30, 1);
    expect(days(officer)).toBeCloseTo(0.5, 2);
  });
});

describe("auth rate limits (docs/02 SEC-06)", () => {
  it("allows 5 failed logins per phone per 15 minutes, then answers 429", async () => {
    await seedJurisdictions();
    const { api } = makeApp({ rateLimits: true });
    const attempt = () =>
      api().post("/api/v1/auth/login").send({ phone: "9876543210", password: "wrong-pass-1" });
    for (let i = 0; i < 5; i++) expect((await attempt()).status).toBe(401);
    const limited = await attempt();
    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe("RATE_LIMITED");

    // A different number from the same IP is counted separately.
    const other = await api()
      .post("/api/v1/auth/login")
      .send({ phone: "9123456780", password: "wrong-pass-1" });
    expect(other.status).toBe(401);
  });
});
