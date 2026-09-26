import { beforeEach, describe, expect, it } from "vitest";
import jwt from "jsonwebtoken";
import { useTestDb } from "../helpers/db.js";
import {
  PASSWORD,
  cookieHeader,
  makeApp,
  refreshCookie,
  registerBody,
  seedJurisdictions,
} from "../helpers/app.js";
import { Session } from "../../src/models/Session.js";
import { User } from "../../src/models/User.js";

useTestDb();

let ctx;
let j;

async function registerAndLogin() {
  const res = await ctx.api().post("/api/v1/auth/register").send(registerBody(j.village));
  return { access: res.body.data.accessToken, refresh: refreshCookie(res).value };
}

const refresh = (value) =>
  ctx.api().post("/api/v1/auth/refresh").set("Cookie", cookieHeader(value));
const me = (access) => ctx.api().get("/api/v1/auth/me").set("Authorization", `Bearer ${access}`);

beforeEach(async () => {
  j = await seedJurisdictions();
  ctx = makeApp();
});

describe("POST /auth/refresh (rotation + reuse detection, docs/05 §7.3)", () => {
  it("rotates the refresh token and returns a new access token", async () => {
    const first = await registerAndLogin();
    const res = await refresh(first.refresh);
    expect(res.status).toBe(200);
    const next = refreshCookie(res).value;
    expect(next).not.toBe(first.refresh);
    expect((await me(res.body.data.accessToken)).status).toBe(200);

    const sessions = await Session.find().sort({ createdAt: 1 }).lean();
    expect(sessions).toHaveLength(2);
    expect(sessions[0].revokedAt).not.toBeNull();
    expect(String(sessions[0].replacedBy)).toBe(String(sessions[1]._id));
    expect(sessions[0].familyId).toBe(sessions[1].familyId);
  });

  it("revokes the whole family when an old token is reused", async () => {
    const first = await registerAndLogin();
    const rotated = refreshCookie(await refresh(first.refresh)).value;

    const reuse = await refresh(first.refresh);
    expect(reuse.status).toBe(401);
    // The attacker's reuse also ends the legitimate, newer session.
    expect((await refresh(rotated)).status).toBe(401);
    expect(await Session.countDocuments({ revokedAt: null })).toBe(0);
  });

  it("rejects a missing, unknown or expired token and clears the cookie", async () => {
    expect((await ctx.api().post("/api/v1/auth/refresh")).status).toBe(401);
    expect((await refresh("not-a-real-token")).status).toBe(401);

    const { refresh: token } = await registerAndLogin();
    await Session.updateMany({}, { expiresAt: new Date(Date.now() - 1000) });
    const res = await refresh(token);
    expect(res.status).toBe(401);
    expect(refreshCookie(res).value).toBe("");
  });

  it("stops working once the account is deactivated", async () => {
    const { refresh: token } = await registerAndLogin();
    await User.updateMany({}, { status: "inactive" });
    expect((await refresh(token)).status).toBe(401);
  });
});

describe("requireAuth (docs/05 §7.4)", () => {
  it("returns the profile for a valid token", async () => {
    const { access } = await registerAndLogin();
    const res = await me(access);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ name: "Sunita Devi", emergencyContactCount: 0 });
  });

  it("distinguishes expired tokens (TOKEN_EXPIRED) from bad ones", async () => {
    const { access } = await registerAndLogin();
    const { sub, ver } = jwt.decode(access);
    const expired = jwt.sign(
      { ver, exp: Math.floor(Date.now() / 1000) - 5 },
      ctx.env.JWT_ACCESS_SECRET,
      { subject: sub },
    );
    expect((await me(expired)).body.error.code).toBe("TOKEN_EXPIRED");
    expect((await me(`${access}x`)).body.error.code).toBe("UNAUTHENTICATED");
  });
});

describe("logout / logout-all (docs/05 §7.5)", () => {
  it("logout revokes only the current session", async () => {
    const a = await registerAndLogin();
    const b = await ctx
      .api()
      .post("/api/v1/auth/login")
      .send({ phone: "9876543210", password: PASSWORD });
    const bRefresh = refreshCookie(b).value;

    const res = await ctx
      .api()
      .post("/api/v1/auth/logout")
      .set("Authorization", `Bearer ${a.access}`)
      .set("Cookie", cookieHeader(a.refresh));
    expect(res.status).toBe(200);
    expect(refreshCookie(res).value).toBe("");
    expect((await refresh(a.refresh)).status).toBe(401);
    expect((await refresh(bRefresh)).status).toBe(200);
  });

  it("logout-all kills every access token and refresh session", async () => {
    const a = await registerAndLogin();
    const b = await ctx
      .api()
      .post("/api/v1/auth/login")
      .send({ phone: "9876543210", password: PASSWORD });

    const res = await ctx
      .api()
      .post("/api/v1/auth/logout-all")
      .set("Authorization", `Bearer ${a.access}`);
    expect(res.status).toBe(200);
    expect((await me(a.access)).status).toBe(401);
    expect((await me(b.body.data.accessToken)).status).toBe(401);
    expect((await refresh(refreshCookie(b).value)).status).toBe(401);
  });
});
