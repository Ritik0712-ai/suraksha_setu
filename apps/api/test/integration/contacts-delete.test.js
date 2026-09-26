import { beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
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
import {
  AuditLog,
  BloodDonor,
  Complaint,
  Notification,
  Session,
  SosAlert,
  User,
} from "../../src/models/index.js";

useTestDb();

let ctx;
let j;
let access;
let refresh;

beforeEach(async () => {
  j = await seedJurisdictions();
  ctx = makeApp();
  const res = await ctx.api().post("/api/v1/auth/register").send(registerBody(j.village));
  access = res.body.data.accessToken;
  refresh = refreshCookie(res).value;
});

const as = (method, path) =>
  ctx.api()[method](`/api/v1${path}`).set("Authorization", `Bearer ${access}`);
const contact = (phone, over = {}) => ({ name: "Maa", relation: "mother", phone, ...over });

describe("emergency contacts (docs/03 S-28)", () => {
  it("adds, lists, edits and deletes contacts", async () => {
    const add = await as("post", "/users/me/contacts").send(
      contact("98111 11111", { email: "Maa@Example.com" }),
    );
    expect(add.status).toBe(201);
    expect(add.body.data).toMatchObject({
      name: "Maa",
      relation: "mother",
      phone: "+919811111111",
      email: "maa@example.com",
    });
    const id = add.body.data.id;

    const edit = await as("patch", `/users/me/contacts/${id}`).send({
      relation: "sister",
      name: "Didi",
    });
    expect(edit.body.data).toMatchObject({ name: "Didi", relation: "sister" });

    const list = await as("get", "/users/me/contacts");
    expect(list.body.data).toHaveLength(1);
    expect((await as("get", "/auth/me")).body.data.emergencyContactCount).toBe(1);

    expect((await as("delete", `/users/me/contacts/${id}`)).status).toBe(200);
    expect((await as("get", "/users/me/contacts")).body.data).toEqual([]);
    expect((await as("delete", `/users/me/contacts/${id}`)).status).toBe(404);
  });

  it("refuses the user's own number, duplicates and a 6th contact", async () => {
    const own = await as("post", "/users/me/contacts")
      .set("Accept-Language", "en")
      .send(contact("9876543210"));
    expect(own.status).toBe(400);
    expect(own.body.error).toMatchObject({
      message: "This is your own number.",
      details: [{ field: "phone", issue: "own_number" }],
    });

    await as("post", "/users/me/contacts").send(contact("9811111111"));
    const dup = await as("post", "/users/me/contacts").send(
      contact("+91 98111 11111", { name: "Papa" }),
    );
    expect(dup.status).toBe(409);
    expect(dup.body.error.details).toEqual([{ field: "phone", issue: "duplicate" }]);

    for (const d of ["2", "3", "4", "5"]) {
      expect((await as("post", "/users/me/contacts").send(contact(`981111111${d}`))).status).toBe(
        201,
      );
    }
    const sixth = await as("post", "/users/me/contacts").send(contact("9811111116"));
    expect(sixth.status).toBe(400);
    expect(sixth.body.error.message).toBe("अधिकतम 5 संपर्क।");
  });

  it("doesn't let an edit collide with another contact", async () => {
    await as("post", "/users/me/contacts").send(contact("9811111111"));
    const b = await as("post", "/users/me/contacts").send(contact("9811111112"));
    const res = await as("patch", `/users/me/contacts/${b.body.data.id}`).send({
      phone: "9811111111",
    });
    expect(res.status).toBe(409);
    // Re-saving a contact's own number is fine.
    const same = await as("patch", `/users/me/contacts/${b.body.data.id}`).send({
      phone: "9811111112",
    });
    expect(same.status).toBe(200);
  });

  it("is for citizens only", async () => {
    await createUser({
      role: "authority",
      phone: "+919000000002",
      jurisdictionId: j.village._id,
      authority: { jurisdictionIds: [j.gp._id] },
    });
    const login = await ctx
      .api()
      .post("/api/v1/auth/login")
      .send({ phone: "9000000002", password: PASSWORD });
    const res = await ctx
      .api()
      .get("/api/v1/users/me/contacts")
      .set("Authorization", `Bearer ${login.body.data.accessToken}`);
    expect(res.status).toBe(403);
  });
});

describe("DELETE /users/me (docs/05 §10)", () => {
  it("needs the correct password", async () => {
    const res = await as("delete", "/users/me").send({ password: "not-my-password" });
    expect(res.status).toBe(400);
    expect((await User.findOne({ phone: "+919876543210" })).status).toBe("active");
  });

  it("anonymises the user, removes personal data and keeps complaints and SOS stats", async () => {
    await as("post", "/users/me/contacts").send(contact("9811111111"));
    const user = await User.findOne({ phone: "+919876543210" });
    const oid = () => new mongoose.Types.ObjectId();
    const pt = { type: "Point", coordinates: [77.123456, 23.234567] };

    await BloodDonor.create({
      userId: user._id,
      bloodGroup: "B+",
      location: pt,
      jurisdictionId: j.village._id,
      displayName: "Sunita D.",
      consentAt: new Date(),
    });
    await Notification.create({ recipientId: user._id, type: "system", templateKey: "notif.x" });
    const complaint = await Complaint.create({
      complaintNo: "SS-2026-000001",
      citizenId: user._id,
      onBehalfOf: { name: "Kamla Bai", phone: "+919822222222" },
      category: "water_supply",
      categorySource: "user_selected",
      location: pt,
      jurisdictionId: j.village._id,
      jurisdictionAncestors: [j.village._id],
      departmentId: oid(),
      timeline: [{ type: "created", visibility: "public", actorRole: "citizen" }],
    });
    const sos = await SosAlert.create({
      userId: user._id,
      status: "RESOLVED_SAFE",
      startLocation: pt,
      lastLocation: pt,
      locationSource: "gps",
      locationHistory: [{ point: pt, at: new Date() }],
      jurisdictionId: j.village._id,
      jurisdictionAncestors: [j.village._id],
      contactsSnapshot: [{ name: "Maa", relation: "mother", phone: "+919811111111" }],
      trackTokenHash: "h",
      trackTokenExpiresAt: new Date(),
      triggeredAt: new Date(),
      lastUpdateAt: new Date(),
    });

    const res = await as("delete", "/users/me").send({ password: PASSWORD });
    expect(res.status).toBe(200);
    expect(refreshCookie(res).value).toBe("");

    const after = await User.findById(user._id).lean();
    expect(after).toMatchObject({
      status: "deleted",
      name: "Deleted user",
      phone: null,
      email: null,
      emergencyContacts: [],
      tokenVersion: 1,
    });
    expect(after.deletedAt).toBeInstanceOf(Date);

    expect(await Session.countDocuments({ userId: user._id })).toBe(0);
    expect(await BloodDonor.countDocuments({ userId: user._id })).toBe(0);
    expect(await Notification.countDocuments({ recipientId: user._id })).toBe(0);

    const c = await Complaint.findById(complaint._id).lean();
    expect(c).toMatchObject({ citizenId: null, onBehalfOf: null, category: "water_supply" });

    const s = await SosAlert.findById(sos._id).lean();
    expect(s.locationHistory).toEqual([]);
    expect(s.contactsSnapshot).toEqual([]);
    expect(s.startLocation.coordinates).toEqual([77.123, 23.235]);
    expect(s.lastLocation.coordinates).toEqual([77.123, 23.235]);

    const log = await AuditLog.findOne({ action: "user.self_deleted" }).lean();
    expect(String(log.targetId)).toBe(String(user._id));

    // The old tokens are dead and the number can register again.
    expect((await as("get", "/auth/me")).status).toBe(401);
    expect(
      (await ctx.api().post("/api/v1/auth/refresh").set("Cookie", cookieHeader(refresh))).status,
    ).toBe(401);
    const again = await ctx.api().post("/api/v1/auth/register").send(registerBody(j.village));
    expect(again.status).toBe(201);
  });
});
