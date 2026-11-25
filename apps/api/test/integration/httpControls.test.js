import { describe, expect, it } from "vitest";
import { serializeRequest } from "../../src/lib/logger.js";
import { signAccessToken } from "../../src/lib/tokens.js";
import { makeApp } from "../helpers/app.js";
import { useTestDb } from "../helpers/db.js";

describe("request logging", () => {
  it("keeps the request id and route while dropping tracking tokens, query values and headers", () => {
    expect(
      serializeRequest({
        id: 1,
        method: "GET",
        url: "https://app.test/api/v1/track/test-only-id?lat=23.2",
        query: { lat: "23.2" },
        headers: { referer: "https://app.test/track/test-only-id" },
      }),
    ).toEqual({ id: 1, method: "GET", url: "/api/v1/track/:token" });
    expect(
      serializeRequest({ id: 2, method: "GET", url: "/api/v1/emergency/nearby?lat=23.2" }),
    ).toEqual({ id: 2, method: "GET", url: "/api/v1/emergency/nearby" });
  });
});

describe("general API rate limit", () => {
  useTestDb();

  it("limits an account across requests without consuming another account's or SOS's budget", async () => {
    const { api, env } = makeApp({ rateLimits: true });
    const bearer = (id) =>
      `Bearer ${signAccessToken({ _id: id, role: "citizen", tokenVersion: 0 }, env.JWT_ACCESS_SECRET)}`;
    const first = bearer("0123456789abcdef01234567");
    const second = bearer("0123456789abcdef01234568");
    const getHelplines = (auth) =>
      api().get("/api/v1/emergency/helplines").set("Authorization", auth);
    for (let i = 0; i < 120; i += 1) await getHelplines(first).expect(200);
    await getHelplines(first).expect(429);
    await getHelplines(second).expect(200);
    // SOS reaches its auth guard even after this token has exhausted the general budget.
    await api().get("/api/v1/sos/mine").set("Authorization", first).expect(401);
  });
});
