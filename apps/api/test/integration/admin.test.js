import { beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { useTestDb } from "../helpers/db.js";
import { PASSWORD, createUser, loginAs, makeApp, seedJurisdictions } from "../helpers/app.js";
import {
  AuditLog,
  ChatMessage,
  Complaint,
  Department,
  Jurisdiction,
  Notification,
  SosAlert,
  UsageEvent,
  User,
} from "../../src/models/index.js";

useTestDb();

let ctx;
let j;
let gp;
let admin;
let asAdmin;
let asGp;
let asCitizen;
let citizen;

beforeEach(async () => {
  j = await seedJurisdictions();
  gp = await Department.create({
    code: "GP_MAHODIYA",
    name: { en: "Gram Panchayat Mahodiya", hi: "ग्राम पंचायत महोदिया" },
    jurisdictionId: j.gp._id,
    handlesCategories: ["road_damage", "garbage", "streetlight", "waterlogging", "other"],
  });
  j.gp.defaultDepartmentId = gp._id;
  await j.gp.save();
  ctx = makeApp();
  admin = await createUser({
    role: "admin",
    name: "Admin One",
    phone: "+919000000001",
    jurisdictionId: j.village._id,
  });
  await createUser({
    role: "authority",
    name: "GP Secretary",
    phone: "+919000000101",
    jurisdictionId: j.village._id,
    authority: { jurisdictionIds: [j.gp._id], departmentId: null },
  });
  citizen = await createUser({
    name: "Sunita Devi",
    phone: "+919876543210",
    jurisdictionId: j.village._id,
  });
  asAdmin = await loginAs(ctx.api, "9000000001");
  asGp = await loginAs(ctx.api, "9000000101");
  asCitizen = await loginAs(ctx.api, "9876543210");
});

async function fileAndResolve() {
  const { body } = await asCitizen("post", "/complaints").send({ category: "garbage" });
  const id = body.data.id;
  await asGp("patch", `/complaints/${id}/status`).send({ status: "VERIFIED" });
  await asGp("patch", `/complaints/${id}/assign`).send({ departmentId: String(gp._id) });
  await asGp("patch", `/complaints/${id}/status`).send({ status: "IN_PROGRESS" });
  await asGp("patch", `/complaints/${id}/status`).send({ status: "RESOLVED", publicNote: "Done" });
  return id;
}

describe("GET /admin/overview (docs/03 A-01)", () => {
  it("shows KPIs, active SOS, the oldest waiting complaints and recent activity, in scope", async () => {
    await fileAndResolve();
    const waiting = (await asCitizen("post", "/complaints").send({ category: "streetlight" })).body
      .data;
    await asCitizen("post", "/sos").send({
      lat: 23.2005,
      lng: 77.0805,
      accuracyM: 10,
      source: "gps",
    });

    const res = await asGp("get", "/admin/overview");
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.kpis).toMatchObject({ openComplaints: 1, resolvedThisWeek: 1, activeSos: 1 });
    expect(d.scope).toEqual([{ en: "Mahodiya", hi: "महोदिया" }]);
    expect(d.kpis.avgResolutionDays).toBe(0);
    expect(d.activeSos[0]).toMatchObject({ name: "Sunita Devi", village: { en: "Mahodiya" } });
    expect(d.needsAction.map((c) => c.id)).toEqual([waiting.id]);
    const kinds = d.activity.map((a) => a.kind);
    expect(kinds).toEqual(
      expect.arrayContaining(["sos_started", "complaint_new", "complaint_status"]),
    );
    expect(d.activity.find((a) => a.kind === "complaint_status").actorName).toBe("GP Secretary");

    // An officer elsewhere sees nothing.
    await createUser({
      role: "authority",
      phone: "+919000000909",
      jurisdictionId: j.village._id,
      authority: { jurisdictionIds: [new mongoose.Types.ObjectId()], departmentId: null },
    });
    const other = await loginAs(ctx.api, "9000000909");
    const empty = await other("get", "/admin/overview");
    expect(empty.body.data.kpis).toEqual({
      openComplaints: 0,
      resolvedThisWeek: 0,
      activeSos: 0,
      avgResolutionDays: null,
    });
    expect((await asCitizen("get", "/admin/overview")).status).toBe(403);
  });
});

describe("GET /admin/meta", () => {
  it("lists villages in scope and departments for the A-02 filters", async () => {
    const res = await asGp("get", "/admin/meta");
    expect(res.body.data.villages.map((v) => v.name.en)).toEqual(["Mahodiya"]);
    expect(res.body.data.departments.map((d) => d.code)).toEqual(["GP_MAHODIYA"]);
  });
});

describe("GET /admin/analytics (docs/03 A-06)", () => {
  it("returns chart series for the range", async () => {
    await fileAndResolve();
    await asCitizen("post", "/complaints").send({ category: "streetlight" });
    await UsageEvent.create([
      { type: "scheme_view", props: { slug: "pm-kisan" } },
      { type: "scheme_view", props: { slug: "pm-kisan" } },
      { type: "eligibility_completed", props: {} },
    ]);
    const today = new Date().toISOString().slice(0, 10);
    const monthAgo = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
    const res = await asGp("get", "/admin/analytics").query({ from: monthAgo, to: today });
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.byCategory.find((x) => x.category === "garbage").count).toBe(1);
    expect(d.funnel).toEqual([
      { status: "SUBMITTED", count: 2 },
      { status: "VERIFIED", count: 1 },
      { status: "ASSIGNED", count: 1 },
      { status: "IN_PROGRESS", count: 1 },
      { status: "RESOLVED", count: 1 },
    ]);
    expect(d.complaintsPerDay.reduce((n, x) => n + x.count, 0)).toBe(2);
    expect(d.resolutionByWeek).toHaveLength(1);
    expect(d.schemes).toEqual({ checks: 1, topViewed: [{ slug: "pm-kisan", views: 2 }] });
    expect(d.ai).toEqual({ withSuggestion: 0, acceptedPct: null, correctedPct: null });
    expect(d.sahayak).toBeNull(); // LLM usage is for admins only

    const bad = await asGp("get", "/admin/analytics").query({ from: today, to: "2020-01-01" });
    expect(bad.status).toBe(400);
    const tooLong = await asGp("get", "/admin/analytics").query({ from: "2020-01-01", to: today });
    expect(tooLong.status).toBe(400);
  });
});

describe("Sahayak usage in analytics (docs/06 task 5.6)", () => {
  it("admins see message, letter and token counts — never message text", async () => {
    const sessionId = new mongoose.Types.ObjectId();
    const expireAt = new Date(Date.now() + 86400_000);
    const base = { sessionId, userId: citizen._id, expireAt };
    await ChatMessage.create([
      { ...base, role: "user", text: "q1" },
      {
        ...base,
        role: "assistant",
        text: "a1",
        intent: "answer",
        llm: { provider: "gemini", model: "m", tokensIn: 1000, tokensOut: 100, latencyMs: 2000 },
      },
      { ...base, role: "user", text: "q2" },
      {
        ...base,
        role: "assistant",
        text: "a2",
        intent: "letter_ready",
        letter: { to: "a", subject: "b", body: "c", applicantName: "d" },
        llm: { provider: "gemini", model: "m", tokensIn: 3000, tokensOut: 300, latencyMs: 4000 },
      },
      { ...base, role: "user", text: "bachao" },
      { ...base, role: "notice", text: "SOS", intent: "emergency" },
    ]);
    const today = new Date().toISOString().slice(0, 10);
    const res = await asAdmin("get", "/admin/analytics").query({ from: today, to: today });
    expect(res.body.data.sahayak).toEqual({
      userMessages: 3,
      llmReplies: 2,
      letters: 1,
      emergencies: 1,
      users: 1,
      tokensInPer100: 200000,
      tokensOutPer100: 20000,
      avgLatencyMs: 3000,
    });
    expect(JSON.stringify(res.body)).not.toContain("bachao");
  });
});

describe("admin users (docs/03 A-07)", () => {
  it("creates an authority with a one-time temporary password that must be changed", async () => {
    const res = await asAdmin("post", "/admin/users").send({
      name: "Ramesh Patel",
      phone: "98111 22233",
      role: "authority",
      jurisdictionIds: [String(j.gp._id)],
      departmentId: String(gp._id),
      title: "Secretary",
    });
    expect(res.status).toBe(201);
    expect(res.body.data.user).toMatchObject({
      name: "Ramesh Patel",
      role: "authority",
      maskedPhone: "+91 98XXX XX233",
      mustChangePassword: true,
      department: { name: { en: "Gram Panchayat Mahodiya" } },
    });
    expect(res.body.data.user.jurisdictions[0].name.en).toBe("Mahodiya");
    const login = await ctx
      .api()
      .post("/api/v1/auth/login")
      .send({ phone: "9811122233", password: res.body.data.tempPassword });
    expect(login.status).toBe(200);
    expect(login.body.data.user.mustChangePassword).toBe(true);

    const dup = await asAdmin("post", "/admin/users").send({
      name: "Someone Else",
      phone: "9811122233",
      role: "admin",
    });
    expect(dup.status).toBe(409);
    const noScope = await asAdmin("post", "/admin/users").send({
      name: "No Scope",
      phone: "9811100000",
      role: "authority",
    });
    expect(noScope.status).toBe(400);
    expect(await AuditLog.countDocuments({ action: "user.created" })).toBe(1);
  });

  it("lists by role, searches, deactivates (old tokens stop working), and refuses self-changes", async () => {
    const list = await asAdmin("get", "/admin/users").query({ role: "authority" });
    expect(list.body.data.items.map((u) => u.name)).toEqual(["GP Secretary"]);
    const search = await asAdmin("get", "/admin/users").query({ q: "3210" });
    expect(search.body.data.items.map((u) => u.name)).toEqual(["Sunita Devi"]);
    expect(search.body.data.items[0]).not.toHaveProperty("phone");

    const gpUser = await User.findOne({ phone: "+919000000101" });
    const off = await asAdmin("patch", `/admin/users/${gpUser._id}`).send({ status: "inactive" });
    expect(off.body.data.status).toBe("inactive");
    expect((await asGp("get", "/admin/overview")).status).toBe(401);
    const back = await asAdmin("patch", `/admin/users/${gpUser._id}`).send({ status: "active" });
    expect(back.body.data.status).toBe("active");

    expect(
      (await asAdmin("patch", `/admin/users/${admin._id}`).send({ status: "inactive" })).status,
    ).toBe(409);
    expect(
      (await asAdmin("patch", `/admin/users/${citizen._id}`).send({ role: "admin" })).status,
    ).toBe(400);
    const actions = (await AuditLog.find({}).sort({ _id: 1 }).lean()).map((a) => a.action);
    expect(actions).toEqual(["user.deactivated", "user.reactivated"]);
  });

  it("is admin only", async () => {
    expect((await asGp("get", "/admin/users")).status).toBe(403);
  });
});

describe("departments and jurisdictions (docs/03 A-11, A-12)", () => {
  it("lists departments with routing gaps and creates/edits them", async () => {
    const res = await asAdmin("get", "/admin/departments");
    expect(res.body.data.items.map((d) => d.code)).toEqual(["GP_MAHODIYA"]);
    // water_supply and encroachment have no department: they fall back to the GP default.
    expect(res.body.data.gaps.map((g) => g.category).sort()).toEqual([
      "encroachment",
      "water_supply",
    ]);

    const body = {
      name: { hi: "पीएचई", en: "PHED Sehore" },
      code: "phed_sehore",
      jurisdictionId: String(j.district._id),
      handlesCategories: ["water_supply"],
    };
    const created = await asAdmin("post", "/admin/departments").send(body);
    expect(created.body.data.code).toBe("PHED_SEHORE");
    expect((await asAdmin("post", "/admin/departments").send(body)).status).toBe(409);
    const after = await asAdmin("get", "/admin/departments");
    expect(after.body.data.gaps.map((g) => g.category)).toEqual(["encroachment"]);
    await asAdmin("patch", `/admin/departments/${created.body.data.id}`).send({
      ...body,
      active: false,
    });
    expect((await Department.findById(created.body.data.id)).active).toBe(false);
  });

  it("creates a village under a GP (ancestors set), validates the parent level", async () => {
    const list = await asAdmin("get", "/admin/jurisdictions");
    expect(list.body.data).toHaveLength(5);
    const body = {
      name: { hi: "दोराहा", en: "Doraha" },
      type: "village",
      parentId: String(j.gp._id),
      centroid: { lat: 23.25, lng: 77.1 },
      defaultDepartmentId: String(gp._id),
    };
    const created = await asAdmin("post", "/admin/jurisdictions").send(body);
    expect(created.status).toBe(201);
    const doc = await Jurisdiction.findById(created.body.data.id).lean();
    expect(doc.ancestors.map(String)).toEqual(
      [j.state, j.district, j.block, j.gp].map((x) => String(x._id)),
    );
    const wrongLevel = await asAdmin("post", "/admin/jurisdictions").send({
      ...body,
      type: "district",
    });
    expect(wrongLevel.status).toBe(400);
    const moveWithKids = await asAdmin("patch", `/admin/jurisdictions/${j.gp._id}`).send({
      name: j.gp.name,
      type: "gram_panchayat",
      parentId: String(j.district._id),
      centroid: { lat: 23.2, lng: 77.08 },
    });
    expect(moveWithKids.status).toBe(409);
  });
});

describe("audit log (docs/03 A-13)", () => {
  it("lists entries with actor names, filtered by action prefix", async () => {
    await fileAndResolve();
    const res = await asAdmin("get", "/admin/audit-logs").query({ action: "complaint." });
    expect(res.body.data.total).toBe(4);
    expect(res.body.data.items[0]).toMatchObject({
      actor: { name: "GP Secretary", role: "authority" },
      targetType: "complaints",
    });
    const none = await asAdmin("get", "/admin/audit-logs").query({ action: "scheme." });
    expect(none.body.data.total).toBe(0);
  });
});

describe("notifications (docs/03 S-29)", () => {
  it("lists newest first with an unread count, and marks read", async () => {
    await fileAndResolve();
    const res = await asCitizen("get", "/notifications");
    expect(res.body.data.unread).toBe(5); // submitted + 4 status changes
    expect(res.body.data.items[0]).toMatchObject({
      templateKey: "notif.complaintStatus",
      params: { status: "RESOLVED" },
      read: false,
    });
    const one = await asCitizen("post", "/notifications/read").send({
      ids: [res.body.data.items[0].id],
    });
    expect(one.body.data).toEqual({ marked: 1, unread: 4 });
    const all = await asCitizen("post", "/notifications/read").send({ all: true });
    expect(all.body.data.unread).toBe(0);
    // Someone else's ids are ignored.
    const n = await Notification.create({
      recipientId: admin._id,
      type: "system",
      templateKey: "notif.system",
    });
    const theirs = await asCitizen("post", "/notifications/read").send({ ids: [String(n._id)] });
    expect(theirs.body.data.marked).toBe(0);
  });
});

describe("POST /events", () => {
  it("accepts client events and refuses server-only types", async () => {
    const ok = await ctx
      .api()
      .post("/api/v1/events")
      .send({ type: "emergency_call_tap", props: { number: "112" } });
    expect(ok.status).toBe(202);
    const bad = await ctx.api().post("/api/v1/events").send({ type: "sos_triggered" });
    expect(bad.status).toBe(400);
    expect(await UsageEvent.countDocuments({ type: "emergency_call_tap" })).toBe(1);
    expect(PASSWORD).toBeTruthy();
    expect(await Complaint.countDocuments()).toBe(0);
    expect(await SosAlert.countDocuments()).toBe(0);
  });
});
