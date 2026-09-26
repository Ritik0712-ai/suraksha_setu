import { beforeEach, describe, expect, it } from "vitest";
import { useTestDb } from "../helpers/db.js";
import { createUser, makeApp, registerBody, seedJurisdictions } from "../helpers/app.js";

useTestDb();

let ctx;
let j;
let access;

beforeEach(async () => {
  j = await seedJurisdictions();
  ctx = makeApp();
  const res = await ctx.api().post("/api/v1/auth/register").send(registerBody(j.village));
  access = res.body.data.accessToken;
});

const patchMe = (body) =>
  ctx.api().patch("/api/v1/users/me").set("Authorization", `Bearer ${access}`).send(body);

describe("PATCH /users/me", () => {
  it("updates language, text size, name and email", async () => {
    const res = await patchMe({
      language: "en",
      textSize: "lg",
      name: "सुनीता देवी",
      email: "Sunita@Example.com",
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      language: "en",
      textSize: "lg",
      name: "सुनीता देवी",
      email: "sunita@example.com",
    });
  });

  it("returns 409 when the email belongs to someone else", async () => {
    await createUser({
      phone: "+919812345678",
      email: "taken@example.com",
      jurisdictionId: j.village._id,
    });
    const res = await patchMe({ email: "taken@example.com" });
    expect(res.status).toBe(409);
    expect(res.body.error.details).toEqual([{ field: "email", issue: "taken" }]);
  });

  it("refuses fields that can't be changed here", async () => {
    const res = await patchMe({ role: "admin" });
    expect(res.status).toBe(400);
    const tokenVersion = await patchMe({ tokenVersion: 5 });
    expect(tokenVersion.status).toBe(400);
  });

  it("moves the user to another village", async () => {
    const other = await (
      await import("../../src/models/Jurisdiction.js")
    ).Jurisdiction.create({
      name: { en: "Bilkisganj", hi: "बिलकिसगंज" },
      type: "village",
      parentId: j.gp._id,
      centroid: { type: "Point", coordinates: [77.1, 23.1] },
    });
    const res = await patchMe({ jurisdictionId: String(other._id) });
    expect(res.status).toBe(200);
    expect(res.body.data.jurisdictionId).toBe(String(other._id));
  });
});

describe("GET /jurisdictions (village picker, docs/03 S-04)", () => {
  it("lists active villages and searches Hindi and English names", async () => {
    const villages = await ctx.api().get("/api/v1/jurisdictions?type=village");
    expect(villages.status).toBe(200);
    expect(villages.body.data).toEqual([
      expect.objectContaining({ name: { en: "Mahodiya", hi: "महोदिया" }, type: "village" }),
    ]);

    const hi = await ctx.api().get(`/api/v1/jurisdictions?q=${encodeURIComponent("महो")}`);
    expect(hi.body.data.map((x) => x.type).sort()).toEqual(["gram_panchayat", "village"]);

    const none = await ctx.api().get("/api/v1/jurisdictions?q=.*");
    expect(none.body.data).toEqual([]);
  });

  it("keeps the ancestor chain in order (docs/05 §5.4)", async () => {
    const { Jurisdiction } = await import("../../src/models/Jurisdiction.js");
    const v = await Jurisdiction.findById(j.village._id);
    expect(v.ancestors.map(String)).toEqual(
      [j.state, j.district, j.block, j.gp].map((x) => String(x._id)),
    );
    expect(v.selfAndAncestors().map(String)).toEqual(
      [j.village, j.gp, j.block, j.district, j.state].map((x) => String(x._id)),
    );
  });
});
