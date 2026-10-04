import { beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { useTestDb } from "../helpers/db.js";
import { createUser, loginAs, makeApp, seedJurisdictions } from "../helpers/app.js";
import { Complaint, Department, Notification, Upload, UsageEvent } from "../../src/models/index.js";
import { cleanupStaleUploads } from "../../src/jobs/uploadJobs.js";
import { istDayStart } from "../../src/modules/complaints/service.js";

useTestDb();

// Tiny buffers with the right magic bytes; the memory storage never decodes them.
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 1)]);
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(200, 2),
]);
const GIF = Buffer.concat([Buffer.from("GIF89a"), Buffer.alloc(200, 3)]);

const HERE = { lat: 23.2005, lng: 77.0805, accuracyM: 15 }; // resolves to Mahodiya village
const SUGGESTION = {
  category: "water_supply",
  confidence: 0.91,
  top3: [
    { category: "water_supply", confidence: 0.91 },
    { category: "waterlogging", confidence: 0.06 },
    { category: "other", confidence: 0.02 },
  ],
  modelVersion: "civic_cnn_v1",
  inferenceMs: 140,
};

let ctx;
let j;
let citizen;
let as;
let gpDept;
let phed;

beforeEach(async () => {
  j = await seedJurisdictions();
  gpDept = await Department.create({
    code: "GP_MAHODIYA",
    name: { en: "Gram Panchayat Mahodiya", hi: "ग्राम पंचायत महोदिया" },
    jurisdictionId: j.gp._id,
    handlesCategories: ["road_damage", "garbage", "streetlight", "waterlogging", "other"],
  });
  phed = await Department.create({
    code: "PHED_SEHORE",
    name: { en: "PHED Sehore", hi: "पीएचई सीहोर" },
    jurisdictionId: j.district._id,
    handlesCategories: ["water_supply"],
  });
  j.gp.defaultDepartmentId = gpDept._id;
  await j.gp.save();
  ctx = makeApp();
  citizen = await createUser({
    name: "Sunita Devi",
    phone: "+919876543210",
    jurisdictionId: j.village._id,
  });
  as = await loginAs(ctx.api, "9876543210");
});

const classify = (buf = JPEG, name = "photo.jpg") =>
  as("post", "/complaints/classify").attach("image", buf, name);

async function uploadWith(suggestion) {
  ctx.ai.next = suggestion;
  const res = await classify();
  expect(res.status).toBe(201);
  return res.body.data;
}

const file = (body) => as("post", "/complaints").send(body);

async function officer({ departmentId = null, jurisdictionIds = [j.gp._id] } = {}) {
  const phone = `+9190000${String(Math.floor(Math.random() * 1e5)).padStart(5, "0")}`;
  await createUser({
    role: "authority",
    phone,
    name: "Mr Verma",
    jurisdictionId: j.village._id,
    authority: { jurisdictionIds, departmentId },
  });
  return loginAs(ctx.api, phone.slice(3));
}

describe("POST /complaints/classify (docs/02 §8.2)", () => {
  it("stores the photo, asks the AI and returns the suggestion", async () => {
    ctx.ai.next = SUGGESTION;
    const res = await classify();
    expect(res.status).toBe(201);
    const d = res.body.data;
    expect(d.imageUrl).toMatch(/^https:\/\/res\.cloudinary\.com\//);
    expect(d.suggestion).toEqual({
      category: "water_supply",
      confidence: 0.91,
      top3: SUGGESTION.top3,
      modelVersion: "civic_cnn_v1",
    });
    expect(ctx.ai.calls).toEqual([d.imageUrl]);
    const up = await Upload.findById(d.uploadId).lean();
    expect(up).toMatchObject({ status: "pending", purpose: "complaint" });
    expect(up.aiSuggestion.category).toBe("water_supply");
    expect(ctx.storage.files.size).toBe(1);
  });

  it("returns suggestion null when the AI is down (manual categories)", async () => {
    ctx.ai.next = null;
    const res = await classify(PNG, "p.png");
    expect(res.status).toBe(201);
    expect(res.body.data.suggestion).toBeNull();
    expect(res.body.data.uploadId).toBeTruthy();
  });

  it("checks magic bytes, not the file name or MIME type", async () => {
    const res = await classify(GIF, "sneaky.jpg");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(ctx.storage.files.size).toBe(0);
  });

  it("requires a file and refuses files over 5 MB", async () => {
    const none = await as("post", "/complaints/classify").field("x", "1");
    expect(none.status).toBe(400);
    const big = Buffer.concat([JPEG, Buffer.alloc(5 * 1024 * 1024)]);
    const res = await classify(big);
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/5 MB/);
  });

  it("is for citizens only", async () => {
    const off = await officer();
    const res = await off("post", "/complaints/classify").attach("image", JPEG, "a.jpg");
    expect(res.status).toBe(403);
  });

  it("fails cleanly when photo storage is unavailable", async () => {
    const broken = makeApp({ storage: null });
    const as2 = await loginAs(broken.api, "9876543210");
    const res = await as2("post", "/complaints/classify").attach("image", JPEG, "a.jpg");
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("INTERNAL");
  });
});

describe("GET /complaints/classify/warmup and /route-preview", () => {
  it("reports the AI state without ever failing", async () => {
    expect((await as("get", "/complaints/classify/warmup")).body.data).toEqual({ ai: "up" });
    ctx.ai.up = false;
    const res = await as("get", "/complaints/classify/warmup");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ ai: "down" });
  });

  it("previews the department for a category and location", async () => {
    const water = await as("get", "/complaints/route-preview").query({
      category: "water_supply",
      lat: HERE.lat,
      lng: HERE.lng,
    });
    expect(water.status).toBe(200);
    expect(water.body.data.department.name.en).toBe("PHED Sehore");
    expect(water.body.data.village.name.en).toBe("Mahodiya");
    const road = await as("get", "/complaints/route-preview").query({ category: "road_damage" });
    expect(road.body.data.department.name.en).toBe("Gram Panchayat Mahodiya");
  });
});

describe("POST /complaints (docs/05 §5.6.1)", () => {
  it("creates a SUBMITTED complaint, routed, numbered, with the photo and AI suggestion", async () => {
    const up = await uploadWith(SUGGESTION);
    const res = await file({
      uploadId: up.uploadId,
      category: "water_supply",
      location: HERE,
      landmark: "प्राथमिक स्कूल के पास",
      description: "हैंडपंप 3 हफ्ते से खराब है",
      // The client can't forge the AI suggestion: this is ignored.
      aiSuggestion: { category: "garbage", confidence: 1, modelVersion: "fake" },
    });
    expect(res.status).toBe(201);
    const d = res.body.data;
    expect(d.complaintNo).toMatch(/^SS-\d{4}-000001$/);
    expect(d).toMatchObject({
      status: "SUBMITTED",
      category: "water_supply",
      categorySource: "ai_accepted",
      imageUrl: up.imageUrl,
      landmark: "प्राथमिक स्कूल के पास",
      location: { lat: HERE.lat, lng: HERE.lng },
      village: { en: "Mahodiya", hi: "महोदिया" },
      canReopen: false,
    });
    expect(d.department.name.en).toBe("PHED Sehore");
    expect(d.timeline).toEqual([
      expect.objectContaining({ type: "created", toStatus: "SUBMITTED" }),
    ]);

    const doc = await Complaint.findById(d.id).lean();
    expect(doc.aiSuggestion.modelVersion).toBe("civic_cnn_v1");
    expect(String(doc.departmentId)).toBe(String(phed._id));
    expect(doc.jurisdictionAncestors.map(String)).toContain(String(j.gp._id));
    const upload = await Upload.findById(up.uploadId).lean();
    expect(upload).toMatchObject({ status: "attached" });
    expect(String(upload.attachedTo)).toBe(d.id);

    // Citizen notification, live event to the scope, usage metric.
    const n = await Notification.findOne({ recipientId: citizen._id }).lean();
    expect(n).toMatchObject({ type: "complaint_submitted", link: `/complaints/${d.id}` });
    expect(n.params.complaintNo).toBe(d.complaintNo);
    const live = ctx.realtime.events.find((e) => e.event === "complaint:new");
    expect(live.rooms).toContain(String(j.gp._id));
    expect(live.payload).toMatchObject({ id: d.id, category: "water_supply" });
    const usage = await UsageEvent.findOne({ type: "complaint_ai_accepted" }).lean();
    expect(usage.props).toMatchObject({ suggested: "water_supply", chosen: "water_supply" });
  });

  it("records user_selected (and the AI suggestion) when the citizen changes the category", async () => {
    const up = await uploadWith(SUGGESTION);
    const res = await file({ uploadId: up.uploadId, category: "waterlogging", location: HERE });
    expect(res.body.data.categorySource).toBe("user_selected");
    expect(res.body.data.department.name.en).toBe("Gram Panchayat Mahodiya");
    const doc = await Complaint.findById(res.body.data.id).lean();
    expect(doc.aiSuggestion.category).toBe("water_supply");
    expect(await UsageEvent.countDocuments({ type: "complaint_ai_changed" })).toBe(1);
  });

  it("doesn't count a low-confidence suggestion as accepted", async () => {
    const up = await uploadWith({ ...SUGGESTION, confidence: 0.45 });
    const res = await file({ uploadId: up.uploadId, category: "water_supply", location: HERE });
    expect(res.body.data.categorySource).toBe("user_selected");
  });

  it("works without a photo and without a location (home village centroid)", async () => {
    const res = await file({ category: "streetlight" });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      imageUrl: null,
      categorySource: "user_selected",
      location: { lat: 23.2, lng: 77.08 },
    });
    expect(await UsageEvent.countDocuments()).toBe(0);
  });

  it("stores 'on behalf of' and numbers complaints in sequence", async () => {
    const a = await file({ category: "garbage", onBehalfOf: { name: "Ramesh Kumar", phone: "" } });
    const b = await file({
      category: "garbage",
      onBehalfOf: { name: "Kamla Bai", phone: "98111 22233" },
    });
    expect(a.body.data.onBehalfOf).toEqual({ name: "Ramesh Kumar" });
    expect(b.body.data.complaintNo).toMatch(/-000002$/);
    const doc = await Complaint.findById(b.body.data.id).lean();
    expect(doc.onBehalfOf.phone).toBe("+919811122233");
  });

  it("refuses someone else's, an attached or a stale upload", async () => {
    const up = await uploadWith(null);
    await createUser({ phone: "+919800000001", jurisdictionId: j.village._id });
    const other = await loginAs(ctx.api, "9800000001");
    const theirs = await other("post", "/complaints").send({
      uploadId: up.uploadId,
      category: "garbage",
    });
    expect(theirs.status).toBe(400);
    expect(theirs.body.error.details).toEqual([{ field: "uploadId", issue: "invalid" }]);

    expect((await file({ uploadId: up.uploadId, category: "garbage" })).status).toBe(201);
    expect((await file({ uploadId: up.uploadId, category: "garbage" })).status).toBe(400);

    const old = await uploadWith(null);
    // createdAt is immutable in Mongoose, so age the record through the driver.
    await Upload.collection.updateOne(
      { _id: new mongoose.Types.ObjectId(old.uploadId) },
      { $set: { createdAt: new Date(Date.now() - 23.5 * 3600 * 1000) } },
    );
    expect((await file({ uploadId: old.uploadId, category: "garbage" })).status).toBe(400);
  });

  it("validates the body", async () => {
    const res = await file({
      category: "potholes",
      description: "x".repeat(501),
      location: { lat: 51.5, lng: -0.12 },
      onBehalfOf: { name: "" },
    });
    expect(res.status).toBe(400);
    const fields = res.body.error.details.map((d) => d.field);
    expect(fields).toEqual(
      expect.arrayContaining(["category", "description", "location.lat", "onBehalfOf.name"]),
    );
  });

  it("allows 10 complaints per day (IST), then 429", async () => {
    const base = {
      complaintNo: "SS-2026-900000",
      citizenId: citizen._id,
      category: "garbage",
      categorySource: "user_selected",
      location: { type: "Point", coordinates: [77.08, 23.2] },
      jurisdictionId: j.village._id,
      jurisdictionAncestors: [j.village._id, j.gp._id],
      departmentId: gpDept._id,
      timeline: [{ type: "created", visibility: "public", actorRole: "citizen" }],
    };
    await Complaint.insertMany(
      Array.from({ length: 10 }, (_, i) => ({ ...base, complaintNo: `SS-2026-90000${i}` })),
    );
    const res = await file({ category: "garbage" });
    expect(res.status).toBe(429);
    expect(res.body.error.message).toMatch(/10/);
  });

  it("fails with 409 when no department can take the complaint", async () => {
    await Department.updateMany({}, { active: false });
    const res = await file({ category: "garbage" });
    expect(res.status).toBe(409);
  });
});

describe("GET /complaints/mine and /complaints/:id", () => {
  it("lists own complaints newest first with status filters and pages of 20", async () => {
    const ids = [];
    for (let i = 0; i < 3; i += 1) ids.push((await file({ category: "garbage" })).body.data.id);
    await Complaint.updateOne({ _id: ids[0] }, { status: "RESOLVED", resolvedAt: new Date() });
    await Complaint.updateOne({ _id: ids[1] }, { status: "REJECTED" });

    const all = await as("get", "/complaints/mine");
    expect(all.status).toBe(200);
    expect(all.body.data.items.map((c) => c.id)).toEqual([...ids].reverse());
    expect(all.body.data.nextPage).toBeNull();
    expect(all.body.data.items[0]).toMatchObject({
      category: "garbage",
      status: "SUBMITTED",
      village: { en: "Mahodiya", hi: "महोदिया" },
    });
    const open = await as("get", "/complaints/mine").query({ status: "open" });
    expect(open.body.data.items.map((c) => c.id)).toEqual([ids[2]]);
    const resolved = await as("get", "/complaints/mine").query({ status: "resolved" });
    expect(resolved.body.data.items.map((c) => c.id)).toEqual([ids[0]]);
    const rejected = await as("get", "/complaints/mine").query({ status: "rejected" });
    expect(rejected.body.data.items.map((c) => c.id)).toEqual([ids[1]]);
  });

  it("paginates", async () => {
    const base = {
      citizenId: citizen._id,
      category: "garbage",
      categorySource: "user_selected",
      location: { type: "Point", coordinates: [77.08, 23.2] },
      jurisdictionId: j.village._id,
      jurisdictionAncestors: [j.village._id],
      departmentId: gpDept._id,
      timeline: [{ type: "created", visibility: "public", actorRole: "citizen" }],
    };
    await Complaint.insertMany(
      Array.from({ length: 23 }, (_, i) => ({
        ...base,
        complaintNo: `SS-2026-8000${String(i).padStart(2, "0")}`,
      })),
    );
    const p1 = await as("get", "/complaints/mine");
    expect(p1.body.data.items).toHaveLength(20);
    expect(p1.body.data.nextPage).toBe(2);
    const p2 = await as("get", "/complaints/mine").query({ page: 2 });
    expect(p2.body.data.items).toHaveLength(3);
    expect(p2.body.data.nextPage).toBeNull();
  });

  it("shows the owner only public timeline events; others get 404", async () => {
    const { id } = (await file({ category: "garbage", location: HERE })).body.data;
    await Complaint.updateOne(
      { _id: id },
      {
        $push: {
          timeline: [
            {
              type: "internal_note",
              text: "call sarpanch",
              visibility: "internal",
              actorRole: "authority",
            },
            {
              type: "public_note",
              text: "Team visiting",
              visibility: "public",
              actorRole: "authority",
            },
          ],
        },
      },
    );
    const mine = await as("get", `/complaints/${id}`);
    expect(mine.status).toBe(200);
    expect(mine.body.data.timeline.map((e) => e.type)).toEqual(["created", "public_note"]);
    expect(mine.body.data.aiSuggestion).toBeUndefined();

    await createUser({ phone: "+919800000002", jurisdictionId: j.village._id });
    const other = await loginAs(ctx.api, "9800000002");
    expect((await other("get", `/complaints/${id}`)).status).toBe(404);
    expect((await as("get", `/complaints/${new mongoose.Types.ObjectId()}`)).status).toBe(404);
  });

  it("gives in-scope authorities the full record; department and jurisdiction scope apply", async () => {
    const { id } = (await file({ category: "water_supply", location: HERE })).body.data;
    const gpAll = await officer({ departmentId: null });
    const full = await gpAll("get", `/complaints/${id}`);
    expect(full.status).toBe(200);
    expect(full.body.data.citizen).toEqual({ name: "Sunita Devi", maskedPhone: "+91 98XXX XX210" });

    const phedOfficer = await officer({ departmentId: phed._id });
    expect((await phedOfficer("get", `/complaints/${id}`)).status).toBe(200);
    const gpOnly = await officer({ departmentId: gpDept._id });
    expect((await gpOnly("get", `/complaints/${id}`)).status).toBe(403);
    const elsewhere = await officer({ jurisdictionIds: [new mongoose.Types.ObjectId()] });
    expect((await elsewhere("get", `/complaints/${id}`)).status).toBe(403);
  });
});

describe("POST /complaints/:id/reopen (docs/05 §5.6.1)", () => {
  async function resolved({ daysAgo = 1, reopenCount = 0 } = {}) {
    const { id } = (await file({ category: "garbage", location: HERE })).body.data;
    await Complaint.updateOne(
      { _id: id },
      { status: "RESOLVED", resolvedAt: new Date(Date.now() - daysAgo * 86400_000), reopenCount },
    );
    return id;
  }
  const reopen = (id, reason = "Still broken after the visit") =>
    as("post", `/complaints/${id}/reopen`).send({ reason });

  it("reopens within 7 days: ASSIGNED, count + 1, timeline, scope alerted", async () => {
    const id = await resolved();
    const before = await as("get", `/complaints/${id}`);
    expect(before.body.data.canReopen).toBe(true);
    const res = await reopen(id);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: "ASSIGNED", reopenCount: 1, canReopen: false });
    expect(res.body.data.timeline.at(-1)).toMatchObject({
      type: "reopened",
      fromStatus: "RESOLVED",
      toStatus: "ASSIGNED",
      text: "Still broken after the visit",
    });
    const live = ctx.realtime.events.find((e) => e.event === "complaint:updated");
    expect(live.payload).toMatchObject({ id, status: "ASSIGNED", reopened: true });
  });

  it("needs a reason of 10+ characters", async () => {
    const id = await resolved();
    expect((await reopen(id, "too short")).status).toBe(400);
  });

  it("refuses after 7 days, after 2 reopens, and when not resolved", async () => {
    expect((await reopen(await resolved({ daysAgo: 8 }))).body.error.code).toBe("CONFLICT");
    expect((await reopen(await resolved({ reopenCount: 2 }))).status).toBe(409);
    const { id } = (await file({ category: "garbage" })).body.data;
    expect((await reopen(id)).status).toBe(409);
  });

  it("only the owner can reopen", async () => {
    const id = await resolved();
    await createUser({ phone: "+919800000003", jurisdictionId: j.village._id });
    const other = await loginAs(ctx.api, "9800000003");
    const res = await other("post", `/complaints/${id}/reopen`).send({ reason: "x".repeat(12) });
    expect(res.status).toBe(404);
  });
});

describe("uploads cleanup job (doc 06 task 4B.9)", () => {
  it("deletes pending uploads older than 24 h (file and record), keeps the rest", async () => {
    const stale = await uploadWith(null);
    const fresh = await uploadWith(null);
    const used = await uploadWith(null);
    await file({ uploadId: used.uploadId, category: "garbage" });
    await Upload.collection.updateMany(
      {
        _id: { $in: [stale.uploadId, used.uploadId].map((id) => new mongoose.Types.ObjectId(id)) },
      },
      { $set: { createdAt: new Date(Date.now() - 25 * 3600 * 1000) } },
    );
    const staleDoc = await Upload.findById(stale.uploadId).lean();

    const r = await cleanupStaleUploads({ storage: ctx.storage });
    expect(r).toEqual({ removed: 1, found: 1 });
    expect(await Upload.exists({ _id: stale.uploadId })).toBeNull();
    expect(await Upload.exists({ _id: fresh.uploadId })).toBeTruthy();
    expect(await Upload.exists({ _id: used.uploadId })).toBeTruthy();
    expect(ctx.storage.files.has(staleDoc.publicId)).toBe(false);
    expect(ctx.storage.files.size).toBe(2);
  });
});

describe("istDayStart", () => {
  it("is midnight in India", () => {
    // 2026-10-02 20:00 UTC is 01:30 on 3 Oct in IST → the IST day started 2 Oct 18:30 UTC.
    expect(istDayStart(new Date("2026-10-02T20:00:00Z")).toISOString()).toBe(
      "2026-10-02T18:30:00.000Z",
    );
    expect(istDayStart(new Date("2026-10-02T10:00:00Z")).toISOString()).toBe(
      "2026-10-01T18:30:00.000Z",
    );
  });
});

describe("me too: nearby open complaints and support", () => {
  let neighbour;
  let asNeighbour;
  beforeEach(async () => {
    neighbour = await createUser({ phone: "+919876500001", jurisdictionId: j.village._id });
    asNeighbour = await loginAs(ctx.api, "9876500001");
  });

  it("shows neighbours open complaints of the same kind within 500 m, without private details", async () => {
    const mine = await file({
      category: "water_supply",
      location: HERE,
      landmark: "स्कूल के पास",
      description: "मेरा नाम और फ़ोन 98765…",
    });
    expect(mine.status).toBe(201);
    await file({ category: "garbage", location: HERE }); // other kind
    const far = { lat: HERE.lat + 0.02, lng: HERE.lng }; // ~2 km away
    await file({ category: "water_supply", location: far });

    const res = await asNeighbour(
      "get",
      `/complaints/nearby?category=water_supply&lat=${HERE.lat}&lng=${HERE.lng + 0.001}`,
    );
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    const item = res.body.data[0];
    expect(item).toMatchObject({
      id: mine.body.data.id,
      complaintNo: mine.body.data.complaintNo,
      landmark: "स्कूल के पास",
      supporterCount: 0,
      supportedByMe: false,
    });
    expect(item.distanceM).toBeGreaterThan(90);
    expect(item.distanceM).toBeLessThan(120);
    expect(JSON.stringify(item)).not.toMatch(/description|98765|imageUrl|citizen/);

    // The filer doesn't see their own complaint as a "me too" candidate.
    const own = await as(
      "get",
      `/complaints/nearby?category=water_supply&lat=${HERE.lat}&lng=${HERE.lng}`,
    );
    expect(own.body.data).toEqual([]);
  });

  it("counts each supporter once, can be undone, and shows the count to the filer and officials", async () => {
    const mine = await file({ category: "water_supply", location: HERE });
    const id = mine.body.data.id;
    const add = await asNeighbour("post", `/complaints/${id}/support`);
    expect(add.body.data).toEqual({ id, supporterCount: 1, supportedByMe: true });
    expect((await asNeighbour("post", `/complaints/${id}/support`)).body.data.supporterCount).toBe(
      1,
    );

    const near = await asNeighbour(
      "get",
      `/complaints/nearby?category=water_supply&lat=${HERE.lat}&lng=${HERE.lng}`,
    );
    expect(near.body.data[0]).toMatchObject({ supporterCount: 1, supportedByMe: true });

    const detail = await as("get", `/complaints/${id}`);
    expect(detail.body.data.supporterCount).toBe(1);
    expect(JSON.stringify(detail.body.data)).not.toContain(String(neighbour._id));

    // Can't support your own complaint.
    expect((await as("post", `/complaints/${id}/support`)).status).toBe(400);

    const undo = await asNeighbour("delete", `/complaints/${id}/support`);
    expect(undo.body.data).toEqual({ id, supporterCount: 0, supportedByMe: false });
    expect(
      (await asNeighbour("delete", `/complaints/${id}/support`)).body.data.supporterCount,
    ).toBe(0);
  });

  it("refuses support for a closed complaint", async () => {
    const mine = await file({ category: "garbage", location: HERE });
    await Complaint.updateOne({ _id: mine.body.data.id }, { status: "RESOLVED" });
    const res = await asNeighbour("post", `/complaints/${mine.body.data.id}/support`);
    expect(res.status).toBe(409);
  });
});
