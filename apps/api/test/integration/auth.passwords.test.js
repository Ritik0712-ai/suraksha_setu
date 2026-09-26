import { beforeEach, describe, expect, it } from "vitest";
import { useTestDb } from "../helpers/db.js";
import {
  PASSWORD,
  cookieHeader,
  createUser,
  makeApp,
  refreshCookie,
  registerBody,
  seedJurisdictions,
} from "../helpers/app.js";
import { AuditLog } from "../../src/models/AuditLog.js";
import { PasswordReset } from "../../src/models/PasswordReset.js";
import { Session } from "../../src/models/Session.js";
import { User } from "../../src/models/User.js";

useTestDb();

let ctx;
let j;
const NEW_PASSWORD = "brand-new-pass-9";

beforeEach(async () => {
  j = await seedJurisdictions();
  ctx = makeApp();
});

const login = (phone, password) => ctx.api().post("/api/v1/auth/login").send({ phone, password });

async function loginAs(phone, password = PASSWORD) {
  const res = await login(phone, password);
  expect(res.status).toBe(200);
  return { access: res.body.data.accessToken, refresh: refreshCookie(res).value };
}

describe("PUT /users/me/password", () => {
  it("rejects a wrong current password", async () => {
    await ctx.api().post("/api/v1/auth/register").send(registerBody(j.village));
    const { access } = await loginAs("9876543210");
    const res = await ctx
      .api()
      .put("/api/v1/users/me/password")
      .set("Authorization", `Bearer ${access}`)
      .send({ currentPassword: "not-my-password", newPassword: NEW_PASSWORD });
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([{ field: "currentPassword", issue: "incorrect" }]);
  });

  it("changes the password, logs out other devices and keeps this one logged in", async () => {
    await createUser({
      phone: "+919876543210",
      mustChangePassword: true,
      jurisdictionId: j.village._id,
    });
    const phone1 = await loginAs("9876543210");
    const phone2 = await loginAs("9876543210");

    const res = await ctx
      .api()
      .put("/api/v1/users/me/password")
      .set("Authorization", `Bearer ${phone1.access}`)
      .send({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.data.user.mustChangePassword).toBe(false);

    const newAccess = res.body.data.accessToken;
    expect(
      (await ctx.api().get("/api/v1/auth/me").set("Authorization", `Bearer ${newAccess}`)).status,
    ).toBe(200);
    expect(
      (await ctx.api().get("/api/v1/auth/me").set("Authorization", `Bearer ${phone2.access}`))
        .status,
    ).toBe(401);
    expect(
      (await ctx.api().post("/api/v1/auth/refresh").set("Cookie", cookieHeader(phone2.refresh)))
        .status,
    ).toBe(401);

    expect((await login("9876543210", PASSWORD)).status).toBe(401);
    expect((await login("9876543210", NEW_PASSWORD)).status).toBe(200);
  });
});

describe("email reset link (docs/03 S-05 / S-05b token mode)", () => {
  it("emails a single-use link and resets the password with it", async () => {
    await createUser({
      phone: "+919876543210",
      email: "sunita@example.com",
      jurisdictionId: j.village._id,
    });
    const { refresh } = await loginAs("9876543210");

    const res = await ctx.api().post("/api/v1/auth/password/forgot").send({ phone: "9876543210" });
    expect(res.body).toEqual({ data: { ok: true } });
    await expect.poll(() => ctx.mailer.sent.length).toBe(1);
    const token = new URL(ctx.mailer.sent[0].text.match(/https:\/\/\S+/)[0]).searchParams.get(
      "token",
    );
    expect(ctx.mailer.sent[0].text).toContain("https://app.test/reset-password?token=");

    const reset = await ctx
      .api()
      .post("/api/v1/auth/password/reset")
      .send({ token, password: NEW_PASSWORD });
    expect(reset.status).toBe(200);
    expect((await login("9876543210", NEW_PASSWORD)).status).toBe(200);
    // Existing sessions were revoked.
    expect(
      (await ctx.api().post("/api/v1/auth/refresh").set("Cookie", cookieHeader(refresh))).status,
    ).toBe(401);

    const again = await ctx
      .api()
      .post("/api/v1/auth/password/reset")
      .send({ token, password: "another-pass-1" });
    expect(again.status).toBe(400);
    expect(again.body.error.message).toBe("यह लिंक/कोड समाप्त हो गया है या गलत है। नया माँगें।");
  });

  it("answers the same for unknown numbers and users without email, and sends nothing", async () => {
    await createUser({ phone: "+919876543210", jurisdictionId: j.village._id });
    const noEmail = await ctx
      .api()
      .post("/api/v1/auth/password/forgot")
      .send({ phone: "9876543210" });
    const unknown = await ctx
      .api()
      .post("/api/v1/auth/password/forgot")
      .send({ phone: "9123456780" });
    expect(noEmail.body).toEqual(unknown.body);
    expect(ctx.mailer.sent).toHaveLength(0);
    expect(await PasswordReset.countDocuments()).toBe(0);
  });

  it("rejects an expired link", async () => {
    await createUser({
      phone: "+919876543210",
      email: "s@example.com",
      jurisdictionId: j.village._id,
    });
    await ctx.api().post("/api/v1/auth/password/forgot").send({ phone: "9876543210" });
    await expect.poll(() => ctx.mailer.sent.length).toBe(1);
    const token = new URL(ctx.mailer.sent[0].text.match(/https:\/\/\S+/)[0]).searchParams.get(
      "token",
    );
    await PasswordReset.updateMany({}, { expiresAt: new Date(Date.now() - 1000) });
    const res = await ctx
      .api()
      .post("/api/v1/auth/password/reset")
      .send({ token, password: NEW_PASSWORD });
    expect(res.status).toBe(400);
  });
});

describe("admin-issued reset code (docs/03 A-07, S-05b code mode)", () => {
  let admin;
  let citizen;

  beforeEach(async () => {
    admin = await createUser({
      role: "admin",
      phone: "+919000000001",
      jurisdictionId: j.district._id,
    });
    citizen = await createUser({ phone: "+919876543210", jurisdictionId: j.village._id });
  });

  async function issueCode() {
    const { access } = await loginAs("9000000001");
    const res = await ctx
      .api()
      .post(`/api/v1/admin/users/${citizen._id}/reset-code`)
      .set("Authorization", `Bearer ${access}`);
    expect(res.status).toBe(201);
    return res.body.data.code;
  }

  const resetWith = (code, password = NEW_PASSWORD) =>
    ctx.api().post("/api/v1/auth/password/reset").send({ phone: "9876543210", code, password });

  it("issues a 6-digit code, audits it, and the code resets the password once", async () => {
    const code = await issueCode();
    expect(code).toMatch(/^\d{6}$/);

    const log = await AuditLog.findOne().lean();
    expect(log).toMatchObject({
      action: "user.reset_code_issued",
      actorRole: "admin",
      targetType: "users",
    });
    expect(String(log.targetId)).toBe(String(citizen._id));
    expect(String(log.actorId)).toBe(String(admin._id));

    expect((await resetWith(code)).status).toBe(200);
    expect((await login("9876543210", NEW_PASSWORD)).status).toBe(200);
    expect((await resetWith(code, "another-pass-1")).status).toBe(400);
  });

  it("burns the code after 5 wrong attempts", async () => {
    const code = await issueCode();
    const wrong = code === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) expect((await resetWith(wrong)).status).toBe(400);
    expect((await resetWith(code)).status).toBe(400);
  });

  it("only the newest code works", async () => {
    const first = await issueCode();
    const second = await issueCode();
    if (first !== second) expect((await resetWith(first)).status).toBe(400);
    expect((await resetWith(second)).status).toBe(200);
  });

  it("is admin-only", async () => {
    await createUser({
      role: "authority",
      phone: "+919000000002",
      jurisdictionId: j.village._id,
      authority: { jurisdictionIds: [j.gp._id] },
    });
    for (const phone of ["9000000002", "9876543210"]) {
      const { access } = await loginAs(phone);
      const res = await ctx
        .api()
        .post(`/api/v1/admin/users/${citizen._id}/reset-code`)
        .set("Authorization", `Bearer ${access}`);
      expect(res.status).toBe(403);
    }
    expect(await PasswordReset.countDocuments()).toBe(0);
  });

  it("returns 404 for an unknown user", async () => {
    const { access } = await loginAs("9000000001");
    const res = await ctx
      .api()
      .post(
        `/api/v1/admin/users/${citizen._id.toString().replace(/.$/, (c) => (c === "0" ? "1" : "0"))}/reset-code`,
      )
      .set("Authorization", `Bearer ${access}`);
    expect(res.status).toBe(404);
  });
});

describe("session revocation on reset", () => {
  it("revokes all sessions when a code reset succeeds", async () => {
    await createUser({ role: "admin", phone: "+919000000001", jurisdictionId: j.district._id });
    const citizen = await createUser({ phone: "+919876543210", jurisdictionId: j.village._id });
    await loginAs("9876543210");
    const { access } = await loginAs("9000000001");
    const { body } = await ctx
      .api()
      .post(`/api/v1/admin/users/${citizen._id}/reset-code`)
      .set("Authorization", `Bearer ${access}`);
    await ctx
      .api()
      .post("/api/v1/auth/password/reset")
      .send({ phone: "9876543210", code: body.data.code, password: NEW_PASSWORD });
    expect(await Session.countDocuments({ userId: citizen._id, revokedAt: null })).toBe(0);
    expect((await User.findById(citizen._id).lean()).tokenVersion).toBe(1);
  });
});
