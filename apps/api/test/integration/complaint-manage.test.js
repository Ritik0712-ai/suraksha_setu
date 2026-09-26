import { beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { useTestDb } from "../helpers/db.js";
import { createUser, loginAs, makeApp, seedJurisdictions } from "../helpers/app.js";
import { AuditLog, Complaint, Department, Notification } from "../../src/models/index.js";

useTestDb();

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(100, 1)]);
let ctx;
let j;
let gp;
let phed;
let citizen;
let asCitizen;
let asGp; // GP secretary: all departments
let asAdmin;

async function officer(phone, authority) {
  await createUser({
    role: "authority",
    phone,
    name: `Officer ${phone.slice(-3)}`,
    jurisdictionId: j.village._id,
    authority,
  });
  return loginAs(ctx.api, phone.slice(3));
}

async function file(body = { category: "garbage" }) {
  const res = await asCitizen("post", "/complaints").send(body);
  expect(res.status).toBe(201);
  return res.body.data.id;
}

beforeEach(async () => {
  j = await seedJurisdictions();
  gp = await Department.create({
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
  ctx = makeApp();
  citizen = await createUser({
    name: "Sunita Devi",
    phone: "+919876543210",
    email: "sunita@example.com",
    jurisdictionId: j.village._id,
  });
  asCitizen = await loginAs(ctx.api, "9876543210");
  asGp = await officer("+919000000101", { jurisdictionIds: [j.gp._id], departmentId: null });
  await createUser({ role: "admin", phone: "+919000000001", jurisdictionId: j.village._id });
  asAdmin = await loginAs(ctx.api, "9000000001");
});

describe("status transitions (docs/05 §5.6.1)", () => {
  it("SUBMITTED → VERIFIED → ASSIGNED → IN_PROGRESS → RESOLVED, citizen sees every step", async () => {
    const id = await file();
    const detail = await asGp("get", `/complaints/${id}`);
    expect(detail.body.data.actions).toEqual({
      statuses: ["VERIFIED", "REJECTED"],
      canAssign: false,
    });

    const v = await asGp("patch", `/complaints/${id}/status`).send({ status: "VERIFIED" });
    expect(v.status).toBe(200);
    expect(v.body.data.status).toBe("VERIFIED");
    expect(v.body.data.firstActionAt).toBeTruthy();

    const opts = await asGp("get", `/complaints/${id}/assign-options`);
    expect(opts.body.data.departments.map((d) => [d.code, d.handlesCategory])).toEqual([
      ["GP_MAHODIYA", true],
      ["PHED_SEHORE", false],
    ]);
    const a = await asGp("patch", `/complaints/${id}/assign`).send({
      departmentId: String(gp._id),
      publicNote: "Sanitation team informed",
    });
    expect(a.body.data).toMatchObject({
      status: "ASSIGNED",
      actions: { statuses: ["IN_PROGRESS"] },
    });

    await asGp("patch", `/complaints/${id}/status`).send({ status: "IN_PROGRESS" });
    const noNote = await asGp("patch", `/complaints/${id}/status`).send({ status: "RESOLVED" });
    expect(noNote.status).toBe(400);
    const r = await asGp("patch", `/complaints/${id}/status`).send({
      status: "RESOLVED",
      publicNote: "Cleaned on 2 Oct",
    });
    expect(r.body.data).toMatchObject({ status: "RESOLVED", canReopen: true });
    expect(r.body.data.timeline.map((e) => e.toStatus).filter(Boolean)).toEqual([
      "SUBMITTED",
      "VERIFIED",
      "ASSIGNED",
      "IN_PROGRESS",
      "RESOLVED",
    ]);
    expect(r.body.data.timeline[2].actorName).toBe("Officer 101");

    // Citizen view: public timeline with the notes; notifications + live events + emails.
    const mine = await asCitizen("get", `/complaints/${id}`);
    expect(mine.body.data.timeline.map((e) => e.text).filter(Boolean)).toEqual([
      "Sanitation team informed",
      "Cleaned on 2 Oct",
    ]);
    const notes = await Notification.find({
      recipientId: citizen._id,
      type: "complaint_status",
    })
      .sort({ _id: 1 })
      .lean();
    expect(notes).toHaveLength(4);
    expect(notes.at(-1).params).toMatchObject({ status: "RESOLVED" });
    expect(
      ctx.realtime.events.filter((e) => e.event === "complaint:updated" && e.to === "user"),
    ).toHaveLength(4);
    expect(ctx.mailer.sent.map((m) => m.to)).toEqual(Array(4).fill("sunita@example.com"));
    expect(ctx.mailer.sent[3].subject).toMatch(/SS-\d{4}-000001/);

    const actions = (await AuditLog.find({ targetType: "complaints" }).lean()).map((x) => x.action);
    expect(actions).toEqual([
      "complaint.status_changed",
      "complaint.assigned",
      "complaint.status_changed",
      "complaint.status_changed",
    ]);
  });

  it("rejects with a reason; 'other' needs text; only an admin can restore", async () => {
    const id = await file();
    const noReason = await asGp("patch", `/complaints/${id}/status`).send({ status: "REJECTED" });
    expect(noReason.status).toBe(400);
    const other = await asGp("patch", `/complaints/${id}/status`).send({
      status: "REJECTED",
      rejection: { code: "other" },
    });
    expect(other.status).toBe(400);
    const rej = await asGp("patch", `/complaints/${id}/status`).send({
      status: "REJECTED",
      rejection: { code: "duplicate" },
    });
    expect(rej.body.data).toMatchObject({ status: "REJECTED", rejection: { code: "duplicate" } });
    expect(rej.body.data.actions.statuses).toEqual([]);

    expect(
      (
        await asGp("patch", `/complaints/${id}/status`).send({
          status: "SUBMITTED",
          internalNote: "x",
        })
      ).status,
    ).toBe(409);
    const adminView = await asAdmin("get", `/complaints/${id}`);
    expect(adminView.body.data.actions.statuses).toEqual(["SUBMITTED"]);
    const restored = await asAdmin("patch", `/complaints/${id}/status`).send({
      status: "SUBMITTED",
      internalNote: "Not a duplicate",
    });
    expect(restored.body.data).toMatchObject({ status: "SUBMITTED", rejection: null });
  });

  it("refuses transitions the table doesn't allow (409)", async () => {
    const id = await file();
    for (const status of ["IN_PROGRESS", "RESOLVED", "ASSIGNED"])
      expect(
        (await asGp("patch", `/complaints/${id}/status`).send({ status, publicNote: "x" })).status,
      ).toBe(409);
    expect(
      (await asGp("patch", `/complaints/${id}/assign`).send({ departmentId: String(gp._id) }))
        .status,
    ).toBe(409);
  });

  it("detects a concurrent change (optimistic check → 409)", async () => {
    const id = await file();
    // Someone else updates it between our read and our write.
    const original = Complaint.findById;
    let raced = false;
    Complaint.findById = function (...args) {
      const q = original.apply(this, args);
      const then = q.then.bind(q);
      q.then = (ok, fail) =>
        then(async (doc) => {
          if (!raced) {
            raced = true;
            await Complaint.collection.updateOne(
              { _id: new mongoose.Types.ObjectId(id) },
              { $set: { landmark: "changed", updatedAt: new Date(Date.now() + 1000) } },
            );
          }
          return doc;
        }).then(ok, fail);
      return q;
    };
    try {
      const res = await asGp("patch", `/complaints/${id}/status`).send({ status: "VERIFIED" });
      expect(res.status).toBe(409);
      expect(raced).toBe(true);
    } finally {
      Complaint.findById = original;
    }
  });
});

describe("assign, category, notes, photo, phone (docs/03 A-03)", () => {
  it("assigns to a department + officer; reassigns from IN_PROGRESS", async () => {
    const id = await file({ category: "water_supply" });
    const phedOfficer = await createUser({
      role: "authority",
      phone: "+919000000202",
      name: "PHED JE",
      jurisdictionId: j.village._id,
      authority: { jurisdictionIds: [j.district._id], departmentId: phed._id },
    });
    await asGp("patch", `/complaints/${id}/status`).send({ status: "VERIFIED" });
    const opts = await asGp("get", `/complaints/${id}/assign-options`);
    expect(opts.body.data.assignees.map((x) => x.name)).toEqual(
      expect.arrayContaining(["PHED JE", "Officer 101"]),
    );
    const wrongDept = await asGp("patch", `/complaints/${id}/assign`).send({
      departmentId: String(gp._id),
      assigneeId: String(phedOfficer._id),
    });
    expect(wrongDept.status).toBe(400);
    const ok = await asGp("patch", `/complaints/${id}/assign`).send({
      departmentId: String(phed._id),
      assigneeId: String(phedOfficer._id),
    });
    expect(ok.body.data.assignee).toEqual({ id: String(phedOfficer._id), name: "PHED JE" });
    await asGp("patch", `/complaints/${id}/status`).send({ status: "IN_PROGRESS" });
    const re = await asGp("patch", `/complaints/${id}/assign`).send({
      departmentId: String(gp._id),
    });
    expect(re.body.data).toMatchObject({ status: "ASSIGNED", assignee: null });
  });

  it("re-categorises as an AI correction", async () => {
    const id = await file({ category: "garbage" });
    const res = await asGp("patch", `/complaints/${id}/category`).send({
      category: "waterlogging",
    });
    expect(res.body.data).toMatchObject({
      category: "waterlogging",
      categorySource: "authority_corrected",
    });
    expect(res.body.data.timeline.at(-1)).toMatchObject({
      type: "category_changed",
      meta: { from: "garbage", to: "waterlogging" },
    });
  });

  it("public notes reach the citizen; internal notes never do", async () => {
    const id = await file();
    await asGp("post", `/complaints/${id}/notes`).send({
      visibility: "internal",
      text: "Call sarpanch",
    });
    await asGp("post", `/complaints/${id}/notes`).send({
      visibility: "public",
      text: "Team visiting",
    });
    const staff = await asGp("get", `/complaints/${id}`);
    expect(staff.body.data.timeline.map((e) => e.text).filter(Boolean)).toEqual([
      "Call sarpanch",
      "Team visiting",
    ]);
    const mine = await asCitizen("get", `/complaints/${id}`);
    expect(mine.body.data.timeline.map((e) => e.text).filter(Boolean)).toEqual(["Team visiting"]);
    expect(await Notification.countDocuments({ type: "complaint_note" })).toBe(1);
  });

  it("uploads a resolution photo during work", async () => {
    const id = await file();
    const early = await asGp("post", `/complaints/${id}/resolution-photo`).attach(
      "image",
      JPEG,
      "a.jpg",
    );
    expect(early.status).toBe(409);
    await asGp("patch", `/complaints/${id}/status`).send({ status: "VERIFIED" });
    await asGp("patch", `/complaints/${id}/assign`).send({ departmentId: String(gp._id) });
    await asGp("patch", `/complaints/${id}/status`).send({ status: "IN_PROGRESS" });
    const res = await asGp("post", `/complaints/${id}/resolution-photo`).attach(
      "image",
      JPEG,
      "a.jpg",
    );
    expect(res.status).toBe(200);
    expect(res.body.data.resolutionImageUrl).toMatch(/resolutions/);
    expect((await asCitizen("get", `/complaints/${id}`)).body.data.resolutionImageUrl).toBeTruthy();
  });

  it("reveals the citizen's phone only with an audit entry", async () => {
    const id = await file({
      category: "garbage",
      onBehalfOf: { name: "Ramesh Kumar", phone: "9811122233" },
    });
    const d = await asGp("get", `/complaints/${id}`);
    expect(d.body.data.citizen.maskedPhone).toBe("+91 98XXX XX210");
    const c = await asGp("post", `/complaints/${id}/reveal-phone`).send({ target: "citizen" });
    expect(c.body.data.phone).toBe("+919876543210");
    const b = await asGp("post", `/complaints/${id}/reveal-phone`).send({ target: "onBehalf" });
    expect(b.body.data.phone).toBe("+919811122233");
    expect(await AuditLog.countDocuments({ action: "complaint.phone_revealed" })).toBe(2);
  });
});

describe("scope (docs/05 §8)", () => {
  it("department and jurisdiction limits apply to reads, writes and lists", async () => {
    const water = await file({ category: "water_supply" });
    const garbage = await file({ category: "garbage" });
    const asPhed = await officer("+919000000303", {
      jurisdictionIds: [j.district._id],
      departmentId: phed._id,
    });
    const asElsewhere = await officer("+919000000404", {
      jurisdictionIds: [new mongoose.Types.ObjectId()],
      departmentId: null,
    });
    expect((await asPhed("get", `/complaints/${water}`)).status).toBe(200);
    expect((await asPhed("get", `/complaints/${garbage}`)).status).toBe(403);
    expect(
      (await asPhed("patch", `/complaints/${garbage}/status`).send({ status: "VERIFIED" })).status,
    ).toBe(403);
    expect((await asElsewhere("get", `/complaints/${water}`)).status).toBe(403);

    const list = await asPhed("get", "/complaints");
    expect(list.body.data.items.map((c) => c.id)).toEqual([water]);
    // Asking for another department's complaints returns nothing, not more.
    const sneaky = await asPhed("get", "/complaints").query({ departmentId: String(gp._id) });
    expect(sneaky.body.data.items).toEqual([]);
    expect((await asElsewhere("get", "/complaints")).body.data.total).toBe(0);
    expect((await asCitizen("get", "/complaints")).status).toBe(403);
  });
});

describe("A-02 list and CSV export", () => {
  it("filters by status/category/number/date, sorts, paginates", async () => {
    const ids = [];
    for (const category of ["garbage", "streetlight", "garbage"])
      ids.push(await file({ category }));
    await asGp("patch", `/complaints/${ids[0]}/status`).send({ status: "VERIFIED" });

    const all = await asGp("get", "/complaints");
    expect(all.body.data).toMatchObject({ total: 3, page: 1, limit: 20 });
    expect(all.body.data.items.map((c) => c.id)).toEqual([...ids].reverse());
    expect(all.body.data.items[0]).toMatchObject({
      ageDays: 0,
      aiAccepted: false,
      village: { en: "Mahodiya" },
    });

    const verified = await asGp("get", "/complaints").query({
      status: "VERIFIED,SUBMITTED",
      category: "garbage",
    });
    expect(verified.body.data.items.map((c) => c.id).sort()).toEqual([ids[0], ids[2]].sort());
    const byNo = await asGp("get", "/complaints").query({ q: "000002" });
    expect(byNo.body.data.items.map((c) => c.id)).toEqual([ids[1]]);
    const oldest = await asGp("get", "/complaints").query({ sort: "age" });
    expect(oldest.body.data.items[0].id).toBe(ids[0]);
    const future = await asGp("get", "/complaints").query({ from: "2999-01-01" });
    expect(future.body.data.total).toBe(0);
    const bad = await asGp("get", "/complaints").query({ status: "OPEN", limit: 7 });
    expect(bad.status).toBe(400);
  });

  it("exports CSV within scope, without phone numbers", async () => {
    await file({ category: "garbage", description: "=cmd|' /C calc'!A0" });
    const res = await asGp("get", "/complaints/export.csv").query({
      from: "2020-01-01",
      to: "2999-01-01",
    });
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/csv/);
    expect(res.headers["content-disposition"]).toContain("complaints_2020-01-01_2999-01-01.csv");
    const lines = res.text.trim().split("\r\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("complaint_no");
    expect(res.text).not.toContain("9876543210");
    expect(res.text).toContain("'=cmd");
  });
});
