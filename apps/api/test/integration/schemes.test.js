import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import mongoose from "mongoose";
import { useTestDb } from "../helpers/db.js";
import { createUser, loginAs, makeApp, seedJurisdictions } from "../helpers/app.js";
import { publishedScheme, schemeBody } from "../helpers/schemes.js";
import {
  AuditLog,
  Notification,
  SavedScheme,
  Scheme,
  UsageEvent,
  User,
} from "../../src/models/index.js";
import { invalidateSchemes } from "../../src/modules/schemes/cache.js";
import { seedSchemes } from "../../src/scripts/seedSchemes.js";

useTestDb();

let ctx;
let j;
let admin;
let citizen;
let asAdmin;
let asCitizen;

beforeEach(async () => {
  invalidateSchemes();
  j = await seedJurisdictions();
  ctx = makeApp();
  admin = await createUser({
    role: "admin",
    phone: "+919000000001",
    jurisdictionId: j.village._id,
  });
  citizen = await createUser({ phone: "+919876543210", jurisdictionId: j.village._id });
  asAdmin = await loginAs(ctx.api, "9000000001");
  asCitizen = await loginAs(ctx.api, "9876543210");
});

describe("GET /schemes and /schemes/:slug (docs/03 S-14, S-15)", () => {
  beforeEach(async () => {
    await publishedScheme(admin._id);
    await publishedScheme(admin._id, {
      slug: "pm-kisan",
      name: { hi: "पीएम किसान", en: "PM-KISAN" },
      categories: ["farmers"],
      level: "central",
      state: undefined,
      tags: ["kisan", "किसान"],
    });
    await Scheme.create({
      ...schemeBody({ slug: "draft-scheme", name: { hi: "ड्राफ़्ट", en: "Draft" } }),
      createdBy: admin._id,
      updatedBy: admin._id,
    });
  });

  it("lists only published schemes, publicly, with category / level / search filters", async () => {
    const all = await ctx.api().get("/api/v1/schemes");
    expect(all.status).toBe(200);
    expect(all.body.data.map((s) => s.slug).sort()).toEqual(["laadli-behna-yojana", "pm-kisan"]);
    expect(all.body.data[0]).not.toHaveProperty("rules");

    const farmers = await ctx.api().get("/api/v1/schemes?category=farmers");
    expect(farmers.body.data.map((s) => s.slug)).toEqual(["pm-kisan"]);
    const state = await ctx.api().get("/api/v1/schemes?level=state");
    expect(state.body.data.map((s) => s.slug)).toEqual(["laadli-behna-yojana"]);

    for (const q of ["किसान", "KISAN", "pm kisan"]) {
      const res = await ctx.api().get("/api/v1/schemes").query({ q });
      expect(res.body.data.map((s) => s.slug)).toEqual(["pm-kisan"]);
    }
    const none = await ctx.api().get("/api/v1/schemes").query({ q: "tractor" });
    expect(none.body.data).toEqual([]);
  });

  it("shows the detail with the trust line; drafts are 404; views are counted", async () => {
    const res = await ctx.api().get("/api/v1/schemes/laadli-behna-yojana");
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      slug: "laadli-behna-yojana",
      sourceName: "MP Govt.",
      officialUrl: "https://cmladlibahna.mp.gov.in",
      saved: null,
    });
    expect(res.body.data.lastVerifiedAt).toBeTruthy();
    expect(res.body.data.documents).toHaveLength(3);
    // Usage events are written after the response.
    await vi.waitFor(async () =>
      expect(await UsageEvent.countDocuments({ type: "scheme_view" })).toBe(1),
    );

    const draft = await ctx.api().get("/api/v1/schemes/draft-scheme");
    expect(draft.status).toBe(404);
    expect(draft.body.error.message).toBe("यह योजना उपलब्ध नहीं है।");
  });
});

describe("POST /schemes/eligibility (docs/05 §5.8)", () => {
  beforeEach(async () => {
    await publishedScheme(admin._id);
    await publishedScheme(admin._id, {
      slug: "no-rules-scheme",
      name: { hi: "बिना नियम", en: "No rules" },
      rules: null,
    });
  });

  it("returns likely / maybe / no with reasons, likely first", async () => {
    const likely = await ctx
      .api()
      .post("/api/v1/schemes/eligibility")
      .send({ answers: { gender: "female", ageBand: "21_40" } });
    expect(likely.status).toBe(200);
    expect(likely.body.data.results.map((r) => [r.slug, r.result])).toEqual([
      ["laadli-behna-yojana", "likely"],
      ["no-rules-scheme", "maybe"],
    ]);
    expect(likely.body.data.counts).toEqual({ likely: 1, maybe: 1, no: 0 });

    const no = await ctx
      .api()
      .post("/api/v1/schemes/eligibility")
      .set("Accept-Language", "en")
      .send({ answers: { gender: "male" } });
    const ladli = no.body.data.results.find((r) => r.slug === "laadli-behna-yojana");
    expect(ladli.result).toBe("no");
    expect(ladli.reasons[0].en).toBe("This scheme is for women");

    const maybe = await ctx
      .api()
      .post("/api/v1/schemes/eligibility")
      .send({ answers: { gender: "female" } });
    const m = maybe.body.data.results.find((r) => r.slug === "laadli-behna-yojana");
    expect(m).toMatchObject({ result: "maybe", reasons: [{ en: "Age will be checked" }] });
    // Usage events are written after the response.
    await vi.waitFor(async () =>
      expect(await UsageEvent.countDocuments({ type: "eligibility_completed" })).toBe(3),
    );
  });

  it("validates answers against the constants", async () => {
    const res = await ctx
      .api()
      .post("/api/v1/schemes/eligibility")
      .send({ answers: { gender: "robot", salary: "lots" } });
    expect(res.status).toBe(400);
  });

  it("keeps the answers on the profile only when a logged-in citizen asks", async () => {
    await asCitizen("post", "/schemes/eligibility").send({ answers: { gender: "female" } });
    expect((await User.findById(citizen._id).lean()).eligibilityAnswers).toBeNull();
    await asCitizen("post", "/schemes/eligibility").send({
      answers: { gender: "female", ageBand: "41_60" },
      save: true,
    });
    expect((await User.findById(citizen._id).lean()).eligibilityAnswers).toEqual({
      gender: "female",
      ageBand: "41_60",
    });
    // A bad token is just anonymous here.
    const anon = await ctx
      .api()
      .post("/api/v1/schemes/eligibility")
      .set("Authorization", "Bearer nope")
      .send({ answers: {} });
    expect(anon.status).toBe(200);
  });
});

describe("saved schemes (docs/03 S-18)", () => {
  let s;
  beforeEach(async () => {
    s = await publishedScheme(admin._id);
  });

  it("saves, ticks documents, lists progress, and unsaves", async () => {
    const put = await asCitizen("put", `/users/me/saved-schemes/${s._id}`).send({
      checkedDocuments: ["aadhaar", "aadhaar", "not_a_doc"],
    });
    expect(put.status).toBe(200);
    expect(put.body.data.checkedDocuments).toEqual(["aadhaar"]);

    const list = await asCitizen("get", "/users/me/saved-schemes");
    expect(list.body.data).toEqual([
      expect.objectContaining({
        slug: "laadli-behna-yojana",
        documentsTotal: 3,
        documentsReady: 1,
        updated: false,
      }),
    ]);

    const detail = await asCitizen("get", "/schemes/laadli-behna-yojana");
    expect(detail.body.data.saved).toEqual({ checkedDocuments: ["aadhaar"] });

    await asCitizen("delete", `/users/me/saved-schemes/${s._id}`);
    expect((await asCitizen("get", "/users/me/saved-schemes")).body.data).toEqual([]);
  });

  it("flags a scheme updated since it was last seen", async () => {
    await asCitizen("put", `/users/me/saved-schemes/${s._id}`).send({});
    await Scheme.updateOne({ _id: s._id }, { version: 2 });
    invalidateSchemes();
    const list = await asCitizen("get", "/users/me/saved-schemes");
    expect(list.body.data[0].updated).toBe(true);
    await asCitizen("get", "/schemes/laadli-behna-yojana"); // viewing marks it seen
    expect((await SavedScheme.findOne({}).lean()).seenVersion).toBe(2);
  });

  it("is for citizens only; unknown schemes are 404", async () => {
    expect((await asAdmin("get", "/users/me/saved-schemes")).status).toBe(403);
    const res = await asCitizen(
      "put",
      `/users/me/saved-schemes/${new mongoose.Types.ObjectId()}`,
    ).send({});
    expect(res.status).toBe(404);
  });
});

describe("admin scheme manager (docs/03 A-08, A-09)", () => {
  it("creates a draft, refuses to publish unverified, verifies, publishes (version 1)", async () => {
    const created = await asAdmin("post", "/admin/schemes").send(schemeBody());
    expect(created.status).toBe(201);
    const id = created.body.data.id;
    expect(created.body.data).toMatchObject({ status: "draft", version: 0, stale: true });
    expect((await ctx.api().get("/api/v1/schemes")).body.data).toEqual([]);

    const early = await asAdmin("post", `/admin/schemes/${id}/publish`);
    expect(early.status).toBe(409);

    const verified = await asAdmin("post", `/admin/schemes/${id}/verify`);
    expect(verified.body.data.stale).toBe(false);
    const pub = await asAdmin("post", `/admin/schemes/${id}/publish`);
    expect(pub.body.data).toMatchObject({ status: "published", version: 1 });
    expect((await ctx.api().get("/api/v1/schemes")).body.data).toHaveLength(1);

    const actions = (await AuditLog.find({}).lean()).map((a) => a.action);
    expect(actions).toEqual(["scheme.created", "scheme.verified", "scheme.published"]);
  });

  it("republishing bumps the version and notifies everyone who saved it", async () => {
    const s = await publishedScheme(admin._id);
    await asCitizen("put", `/users/me/saved-schemes/${s._id}`).send({});
    const edited = await asAdmin("patch", `/admin/schemes/${s._id}`).send(
      schemeBody({ benefitShort: { hi: "नया", en: "New benefit" } }),
    );
    expect(edited.status).toBe(200);
    // Edits to a published scheme are live at once (cache dropped).
    const live = await ctx.api().get("/api/v1/schemes");
    expect(live.body.data[0].benefitShort.en).toBe("New benefit");

    const pub = await asAdmin("post", `/admin/schemes/${s._id}/publish`);
    expect(pub.body.data.version).toBe(2);
    const n = await Notification.findOne({ recipientId: citizen._id }).lean();
    expect(n).toMatchObject({ type: "scheme_updated", link: "/schemes/laadli-behna-yojana" });
    expect(ctx.realtime.events.some((e) => e.event === "notification:new")).toBe(true);
  });

  it("validates the body (both languages, https link, rule values)", async () => {
    const res = await asAdmin("post", "/admin/schemes").send(
      schemeBody({
        name: { hi: "", en: "X" },
        officialUrl: "http://example.com",
        rules: {
          all: [{ field: "gender", op: "eq", value: "robot", failReason: { hi: "x", en: "x" } }],
        },
      }),
    );
    expect(res.status).toBe(400);
    const fields = res.body.error.details.map((d) => d.field);
    expect(fields).toEqual(expect.arrayContaining(["name.hi", "officialUrl", "rules.all.0.value"]));
    await asAdmin("post", "/admin/schemes").send(schemeBody());
    const dup = await asAdmin("post", "/admin/schemes").send(schemeBody());
    expect(dup.status).toBe(409);
  });

  it("unpublishes, duplicates, and deletes drafts only", async () => {
    const s = await publishedScheme(admin._id);
    expect((await asAdmin("delete", `/admin/schemes/${s._id}`)).status).toBe(409);
    const copy = await asAdmin("post", `/admin/schemes/${s._id}/duplicate`);
    expect(copy.body.data).toMatchObject({ slug: "laadli-behna-yojana-copy", status: "draft" });
    expect(copy.body.data.lastVerifiedAt).toBeFalsy();
    await asAdmin("post", `/admin/schemes/${s._id}/unpublish`);
    expect((await ctx.api().get("/api/v1/schemes")).body.data).toEqual([]);
    expect((await asAdmin("delete", `/admin/schemes/${s._id}`)).status).toBe(200);
    expect(await Scheme.countDocuments()).toBe(1);
  });

  it("lists with filters, including 'needs verification'", async () => {
    await publishedScheme(admin._id);
    await asAdmin("post", "/admin/schemes").send(schemeBody({ slug: "new-draft" }));
    const drafts = await asAdmin("get", "/admin/schemes?status=draft");
    expect(drafts.body.data.map((s) => s.slug)).toEqual(["new-draft"]);
    const stale = await asAdmin("get", "/admin/schemes?needsVerification=1");
    expect(stale.body.data.map((s) => s.slug)).toEqual(["new-draft"]);
  });

  it("is admin only", async () => {
    expect((await asCitizen("get", "/admin/schemes")).status).toBe(403);
  });
});

describe("scheme seed (doc 06 task 4C.1)", () => {
  it("imports all 20 seed schemes as valid drafts, idempotently", async () => {
    const data = JSON.parse(
      await readFile(new URL("../../seed/schemes.json", import.meta.url), "utf8"),
    );
    expect(data.schemes).toHaveLength(20);
    expect(await seedSchemes(data)).toEqual({ created: 20, updated: 0, skipped: 0 });
    expect(await seedSchemes(data)).toEqual({ created: 0, updated: 0, skipped: 20 });
    expect(await Scheme.countDocuments({ status: "draft" })).toBe(20);
  });
});
