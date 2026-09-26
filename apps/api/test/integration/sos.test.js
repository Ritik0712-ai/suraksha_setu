import { beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { useTestDb } from "../helpers/db.js";
import { createUser, loginAs, makeApp, seedJurisdictions } from "../helpers/app.js";
import { AuditLog, Notification, SosAlert } from "../../src/models/index.js";
import { autoCloseStaleSos } from "../../src/jobs/sosJobs.js";
import { createRealtimeRecorder } from "../../src/lib/realtime.js";

useTestDb();

let ctx;
let j;
let citizen;
let as;

// Mahodiya's seeded centroid is (77.08, 23.2); points near it resolve to the village.
const HERE = { lat: 23.2005, lng: 77.0805, accuracyM: 12, source: "gps" };

beforeEach(async () => {
  j = await seedJurisdictions();
  ctx = makeApp();
  citizen = await createUser({
    name: "Pooja Sharma",
    phone: "+919876543210",
    jurisdictionId: j.village._id,
    emergencyContacts: [
      { name: "Maa", relation: "mother", phone: "+919811111111", email: "maa@example.com" },
      { name: "Bhaiya", relation: "brother", phone: "+919822222222" },
    ],
  });
  as = await loginAs(ctx.api, "9876543210");
});

const trigger = (body = HERE) => as("post", "/sos").send(body);
const tokenOf = (url) => url.split("/track/")[1];

async function officerIn(jurisdictionIds, extra = {}) {
  const phone = `+9190000${String(Math.floor(Math.random() * 1e5)).padStart(5, "0")}`;
  await createUser({
    role: "authority",
    phone,
    name: "Mr Verma",
    jurisdictionId: j.village._id,
    authority: { jurisdictionIds, departmentId: new mongoose.Types.ObjectId() },
    ...extra,
  });
  return loginAs(ctx.api, phone.slice(3));
}

describe("POST /sos (docs/03 S-06, docs/02 §8.1)", () => {
  it("creates an ACTIVE SOS with the SMS text, recipients and a tracking link", async () => {
    const res = await trigger();
    expect(res.status).toBe(201);
    const d = res.body.data;
    expect(d).toMatchObject({
      status: "ACTIVE",
      existing: false,
      locationSource: "gps",
      approximate: false,
      lastLocation: { lat: 23.2005, lng: 77.0805 },
      smsRecipients: ["+919811111111", "+919822222222"],
      emailTargets: 1,
    });
    expect(d.trackUrl).toMatch(/^https:\/\/app\.test\/track\/[\w-]{40,}$/);
    expect(d.smsBody).toContain("Pooja Sharma को मदद चाहिए!");
    expect(d.smsBody).toContain(d.trackUrl);
    expect(d.smsBody).toContain("https://maps.google.com/?q=23.200500,77.080500");

    const sos = await SosAlert.findById(d.id).lean();
    expect(sos.jurisdictionAncestors.map(String)).toEqual(
      [j.village, j.gp, j.block, j.district, j.state].map((x) => String(x._id)),
    );
    expect(sos.contactsSnapshot).toHaveLength(2);
    expect(sos.trackTokenHash).not.toContain(tokenOf(d.trackUrl)); // only the hash is stored
    expect(sos.trackTokenExpiresAt - sos.triggeredAt).toBe(24 * 3600 * 1000);
  });

  it("alerts the authorities in scope in real time and emails contacts with an email", async () => {
    const res = await trigger();
    const ev = ctx.realtime.events.find((e) => e.event === "sos:new");
    expect(ev.rooms).toEqual(
      [j.village, j.gp, j.block, j.district, j.state].map((x) => String(x._id)),
    );
    expect(ev.payload).toMatchObject({
      status: "ACTIVE",
      user: { name: "Pooja Sharma", maskedPhone: "+91 98XXX XX210" },
    });

    await expect.poll(() => ctx.mailer.sent.length).toBe(1);
    expect(ctx.mailer.sent[0]).toMatchObject({
      to: "maa@example.com",
      subject: "SOS: Pooja Sharma को मदद चाहिए",
    });
    expect(ctx.mailer.sent[0].text).toContain(res.body.data.trackUrl);
    await expect
      .poll(async () => (await SosAlert.findById(res.body.data.id).lean()).emailedTo)
      .toEqual(["maa@example.com"]);
  });

  it("returns the open SOS instead of creating a second one", async () => {
    const first = await trigger();
    const again = await trigger();
    expect(again.status).toBe(200);
    expect(again.body.data).toMatchObject({
      id: first.body.data.id,
      existing: true,
      trackUrl: first.body.data.trackUrl,
    });
    expect(await SosAlert.countDocuments()).toBe(1);
  });

  it("works without GPS: sends the home village centroid, marked approximate", async () => {
    const res = await trigger({ source: "village" });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      locationSource: "village",
      approximate: true,
      lastLocation: { lat: 23.2, lng: 77.08 },
    });
    expect(res.body.data.smsBody).toContain("(अनुमानित)");
  });

  it("marks a poor GPS fix (> 100 m) as approximate", async () => {
    const res = await trigger({ ...HERE, accuracyM: 450 });
    expect(res.body.data.approximate).toBe(true);
  });

  it("still sends with zero contacts (only the authority is alerted)", async () => {
    await mongoose.model("User").updateOne({ _id: citizen._id }, { emergencyContacts: [] });
    const res = await trigger();
    expect(res.status).toBe(201);
    expect(res.body.data.smsRecipients).toEqual([]);
  });

  it("is never rate-limited, but flags more than 3 in an hour for review", async () => {
    for (let i = 0; i < 4; i++) {
      const r = await trigger();
      expect(r.status).toBe(201);
      await as("post", `/sos/${r.body.data.id}/resolve`);
    }
    const flags = (await SosAlert.find().sort({ triggeredAt: 1 }).lean()).map(
      (s) => s.flaggedForReview,
    );
    expect(flags).toEqual([false, false, false, true]);
  });

  it("keeps the client's time for an SOS queued offline", async () => {
    const at = new Date(Date.now() - 90_000);
    const res = await trigger({
      ...HERE,
      triggeredAt: at.toISOString(),
      createdVia: "offline_retry",
    });
    const sos = await SosAlert.findById(res.body.data.id).lean();
    expect(sos.triggeredAt.getTime()).toBe(at.getTime());
    expect(sos.createdVia).toBe("offline_retry");
  });

  it("rejects coordinates outside India and SOS from staff accounts", async () => {
    expect((await trigger({ lat: 51.5, lng: -0.12, source: "gps" })).status).toBe(400);
    const officer = await officerIn([j.gp._id]);
    expect((await officer("post", "/sos").send(HERE)).status).toBe(403);
  });
});

describe("owner actions", () => {
  it("pushes live location updates to the authority and the trail", async () => {
    const { id } = (await trigger()).body.data;
    const res = await as("post", `/sos/${id}/location`).send({
      lat: 23.201,
      lng: 77.081,
      accuracyM: 8,
    });
    expect(res.status).toBe(200);
    const sos = await SosAlert.findById(id).lean();
    expect(sos.locationHistory).toHaveLength(2);
    expect(sos.lastLocation.coordinates).toEqual([77.081, 23.201]);
    expect(ctx.realtime.events.at(-1)).toMatchObject({
      event: "sos:location",
      payload: { lastLocation: { lat: 23.201, lng: 77.081 } },
    });
  });

  it("marks 'I am safe' within 60 s as a false alarm, later as safe, and emails 'safe'", async () => {
    const first = (await trigger()).body.data;
    await expect.poll(() => ctx.mailer.sent.length).toBe(1);
    const r1 = await as("post", `/sos/${first.id}/resolve`);
    expect(r1.body.data.status).toBe("FALSE_ALARM");
    await expect.poll(() => ctx.mailer.sent.length).toBe(2);
    expect(ctx.mailer.sent[1].subject).toBe("Pooja Sharma अब सुरक्षित हैं");

    const second = (await trigger()).body.data;
    await SosAlert.updateOne(
      { _id: second.id },
      { triggeredAt: new Date(Date.now() - 5 * 60_000) },
    );
    const r2 = await as("post", `/sos/${second.id}/resolve`);
    expect(r2.body.data.status).toBe("RESOLVED_SAFE");
    // Location updates stop once it's resolved.
    expect((await as("post", `/sos/${second.id}/location`).send(HERE)).status).toBe(409);
  });

  it("lists the user's SOS history, and only theirs", async () => {
    const { id } = (await trigger()).body.data;
    await as("post", `/sos/${id}/resolve`);
    await trigger();
    const all = await as("get", "/sos/mine");
    expect(all.body.data.map((s) => s.status)).toEqual(["ACTIVE", "FALSE_ALARM"]);
    const open = await as("get", "/sos/mine?open=1");
    expect(open.body.data).toHaveLength(1);

    await createUser({ phone: "+919812345678", jurisdictionId: j.village._id });
    const other = await loginAs(ctx.api, "9812345678");
    expect((await other("get", `/sos/${id}`)).status).toBe(404);
    expect((await other("post", `/sos/${id}/resolve`)).status).toBe(404);
  });
});

describe("GET /track/:token (docs/03 S-30)", () => {
  it("shows the first name, location and trail — and nothing else", async () => {
    const { trackUrl, id } = (await trigger()).body.data;
    await as("post", `/sos/${id}/location`).send({ lat: 23.201, lng: 77.081, accuracyM: 8 });
    const res = await ctx.api().get(`/api/v1/track/${tokenOf(trackUrl)}`);
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.body.data).toMatchObject({
      firstName: "Pooja",
      status: "ACTIVE",
      lastLocation: { lat: 23.201, lng: 77.081 },
      approximate: false,
    });
    expect(res.body.data.trail).toHaveLength(2);
    expect(JSON.stringify(res.body)).not.toMatch(/Sharma|9876543210|9811111111|maa@/);
  });

  it("after 'I am safe' shows the safe state without any location", async () => {
    const { trackUrl, id } = (await trigger()).body.data;
    await as("post", `/sos/${id}/resolve`);
    const res = await ctx.api().get(`/api/v1/track/${tokenOf(trackUrl)}`);
    expect(res.body.data).toEqual({
      firstName: "Pooja",
      status: "FALSE_ALARM",
      resolvedAt: expect.any(String),
    });
  });

  it("expires after 24 hours and rejects made-up tokens", async () => {
    const { trackUrl, id } = (await trigger()).body.data;
    await SosAlert.updateOne(
      { _id: id },
      {
        triggeredAt: new Date(Date.now() - 25 * 3600 * 1000),
        trackTokenExpiresAt: new Date(Date.now() - 3600 * 1000),
      },
    );
    expect((await ctx.api().get(`/api/v1/track/${tokenOf(trackUrl)}`)).status).toBe(404);
    expect((await ctx.api().get(`/api/v1/track/${"x".repeat(43)}`)).status).toBe(404);
  });
});

describe("authority actions (docs/03 A-04, A-05)", () => {
  it("lists active SOS only in the officer's scope, whatever their department", async () => {
    await trigger();
    const blockOfficer = await officerIn([j.block._id]);
    const list = await blockOfficer("get", "/sos/active");
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0]).toMatchObject({
      status: "ACTIVE",
      village: { en: "Mahodiya", hi: "महोदिया" },
    });

    const other = await mongoose.model("Jurisdiction").create({
      name: { en: "Elsewhere", hi: "कहीं और" },
      type: "village",
      parentId: j.gp._id,
      centroid: { type: "Point", coordinates: [78, 24] },
    });
    const outsider = await officerIn([other._id]);
    expect((await outsider("get", "/sos/active")).body.data).toEqual([]);
    const { id } = list.body.data[0];
    expect((await outsider("get", `/sos/${id}`)).status).toBe(403);
    expect((await outsider("post", `/sos/${id}/acknowledge`)).status).toBe(403);
  });

  it("acknowledges (audited), notifies the citizen live, then closes with an outcome", async () => {
    const { id } = (await trigger()).body.data;
    const officer = await officerIn([j.gp._id]);

    const ack = await officer("post", `/sos/${id}/acknowledge`);
    expect(ack.status).toBe(200);
    expect(ack.body.data).toMatchObject({
      status: "ACKNOWLEDGED",
      acknowledgedBy: { name: "Mr Verma" },
    });
    expect((await officer("post", `/sos/${id}/acknowledge`)).status).toBe(409);

    const toCitizen = ctx.realtime.events.filter(
      (e) => e.to === "user" && e.userId === String(citizen._id),
    );
    expect(toCitizen.map((e) => e.event)).toEqual(["sos:acknowledged", "notification:new"]);
    expect(toCitizen[0].payload.officerName).toBe("Mr Verma");
    expect(
      await Notification.countDocuments({ recipientId: citizen._id, type: "sos_acknowledged" }),
    ).toBe(1);
    const mine = await as("get", `/sos/${id}`);
    expect(mine.body.data.acknowledgedBy).toEqual({ name: "Mr Verma" });

    const closed = await officer("post", `/sos/${id}/close`).send({
      outcome: "citizen_safe_confirmed",
      note: "Spoke on phone",
    });
    expect(closed.body.data).toMatchObject({
      status: "RESOLVED_BY_AUTHORITY",
      closeOutcome: "citizen_safe_confirmed",
      closedBy: { name: "Mr Verma" },
    });
    expect((await AuditLog.find().sort({ createdAt: 1 }).lean()).map((l) => l.action)).toEqual([
      "sos.acknowledged",
      "sos.closed",
    ]);
  });

  it("shows contacts' names only, and reveals phones one at a time, audited", async () => {
    const { id } = (await trigger()).body.data;
    const officer = await officerIn([j.gp._id]);
    const detail = await officer("get", `/sos/${id}`);
    expect(detail.body.data.contacts).toEqual([
      { index: 0, name: "Maa", relation: "mother" },
      { index: 1, name: "Bhaiya", relation: "brother" },
    ]);
    expect(JSON.stringify(detail.body)).not.toContain("9811111111");
    expect(detail.body.data.trail).toHaveLength(1);

    const user = await officer("post", `/sos/${id}/reveal-phone`).send({ target: "user" });
    expect(user.body.data.phone).toBe("+919876543210");
    const contact = await officer("post", `/sos/${id}/reveal-phone`).send({
      target: "contact",
      index: 1,
    });
    expect(contact.body.data.phone).toBe("+919822222222");
    expect(await AuditLog.countDocuments({ action: "sos.phone_revealed" })).toBe(2);
  });

  it("citizens can't acknowledge or list", async () => {
    const { id } = (await trigger()).body.data;
    expect((await as("post", `/sos/${id}/acknowledge`)).status).toBe(403);
    expect((await as("get", "/sos/active")).status).toBe(403);
  });
});

describe("auto-close job (docs/01 FR-SOS-11)", () => {
  it("closes SOS with no update for 6 hours", async () => {
    const { id } = (await trigger()).body.data;
    const realtime = createRealtimeRecorder();
    expect(await autoCloseStaleSos({ realtime })).toBe(0);
    await SosAlert.updateOne({ _id: id }, { lastUpdateAt: new Date(Date.now() - 7 * 3600 * 1000) });
    expect(await autoCloseStaleSos({ realtime })).toBe(1);
    expect((await SosAlert.findById(id).lean()).status).toBe("AUTO_CLOSED");
    expect(realtime.events.map((e) => e.event)).toEqual(["sos:updated", "sos:updated"]);
  });
});
