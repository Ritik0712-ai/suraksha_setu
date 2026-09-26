import { describe, expect, it } from "vitest";
import jwt from "jsonwebtoken";
import {
  hashSecret,
  randomCode,
  randomToken,
  sessionTtlMs,
  signAccessToken,
  verifyAccessToken,
} from "../../src/lib/tokens.js";

const SECRET = "s";

describe("access tokens", () => {
  it("carries { sub, role, jur, dept, ver } and expires in 15 minutes", () => {
    const user = {
      _id: "u1",
      role: "authority",
      tokenVersion: 3,
      authority: { jurisdictionIds: ["j1", "j2"], departmentId: "d1" },
    };
    const p = verifyAccessToken(signAccessToken(user, SECRET), SECRET);
    expect(p).toMatchObject({
      sub: "u1",
      role: "authority",
      jur: ["j1", "j2"],
      dept: "d1",
      ver: 3,
    });
    expect(p.exp - p.iat).toBe(15 * 60);
  });

  it("uses the home village as jur for citizens", () => {
    const p = jwt.decode(
      signAccessToken({ _id: "u", role: "citizen", jurisdictionId: "v1" }, SECRET),
    );
    expect(p).toMatchObject({ jur: ["v1"], dept: null, ver: 0 });
  });

  it("reports TOKEN_EXPIRED for expired tokens and UNAUTHENTICATED for bad ones", () => {
    const expired = jwt.sign({ ver: 0, exp: Math.floor(Date.now() / 1000) - 10 }, SECRET);
    expect(() => verifyAccessToken(expired, SECRET)).toThrow(
      expect.objectContaining({ code: "TOKEN_EXPIRED" }),
    );
    expect(() => verifyAccessToken("nope", SECRET)).toThrow(
      expect.objectContaining({ code: "UNAUTHENTICATED" }),
    );
    const other = jwt.sign({ ver: 0 }, "other-secret");
    expect(() => verifyAccessToken(other, SECRET)).toThrow(
      expect.objectContaining({ code: "UNAUTHENTICATED" }),
    );
  });

  it("rejects the 'none' algorithm", () => {
    const none = jwt.sign({ ver: 0 }, null, { algorithm: "none" });
    expect(() => verifyAccessToken(none, SECRET)).toThrow(
      expect.objectContaining({ code: "UNAUTHENTICATED" }),
    );
  });
});

describe("secrets", () => {
  it("makes 256-bit random tokens and 6-digit codes", () => {
    expect(Buffer.from(randomToken(), "base64url")).toHaveLength(32);
    for (let i = 0; i < 50; i++) expect(randomCode()).toMatch(/^\d{6}$/);
  });

  it("hashes with the pepper", () => {
    expect(hashSecret("t", "p1")).not.toBe(hashSecret("t", "p2"));
    expect(hashSecret("t", "p1")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("gives citizens 30-day sessions and staff 12-hour sessions", () => {
    expect(sessionTtlMs("citizen")).toBe(30 * 24 * 3600 * 1000);
    expect(sessionTtlMs("authority")).toBe(12 * 3600 * 1000);
    expect(sessionTtlMs("admin")).toBe(12 * 3600 * 1000);
  });
});
