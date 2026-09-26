import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { useTestDb } from "../helpers/db.js";
import {
  createUser,
  fakeAi,
  loginAs,
  makeApp,
  seedJurisdictions,
  testEnv,
} from "../helpers/app.js";
import { createApp } from "../../src/app.js";
import { createMemoryStorage } from "../../src/lib/storage.js";
import { AuditLog, EmergencyService } from "../../src/models/index.js";
import { seedEmergencyServices } from "../../src/scripts/seedEmergency.js";

useTestDb();

const HERE = { lat: 23.2, lng: 77.08 }; // Mahodiya test centroid
let j;
let admin;

const service = (over = {}) => ({
  name: { hi: "जिला अस्पताल", en: "District Hospital" },
  type: "hospital",
  address: { hi: "सीहोर", en: "Sehore" },
  phones: ["07562-000000"],
  location: { type: "Point", coordinates: [77.09, 23.21] },
  jurisdictionId: j.village._id,
  verifiedAt: new Date("2026-09-01"),
  verifiedBy: admin._id,
  active: true,
  ...over,
});

beforeEach(async () => {
  j = await seedJurisdictions();
  admin = await createUser({
    role: "admin",
    phone: "+919000000001",
    jurisdictionId: j.village._id,
  });
});

function appWithPlaces(places, calls = []) {
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ places }), { status: 200 });
  };
  const app = createApp({
    env: testEnv({ GOOGLE_PLACES_KEY: "places-key" }),
    fetchImpl,
    rateLimits: false,
    storage: createMemoryStorage(),
    ai: fakeAi(),
  });
  return () => request(app);
}

describe("GET /emergency/nearby (docs/03 S-20)", () => {
  it("returns curated services nearest first; hospital includes PHC/CHC; inactive hidden", async () => {
    await EmergencyService.create([
      service(),
      service({
        name: { hi: "PHC", en: "PHC Mahodiya" },
        type: "phc_chc",
        location: { type: "Point", coordinates: [77.081, 23.201] },
      }),
      service({ name: { hi: "पुराना", en: "Closed clinic" }, active: false }),
      service({ name: { hi: "थाना", en: "Police station" }, type: "police" }),
    ]);
    const { api } = makeApp();
    const res = await api()
      .get("/api/v1/emergency/nearby")
      .query({ ...HERE, type: "hospital" });
    expect(res.status).toBe(200);
    const names = res.body.data.services.map((s) => s.name.en);
    expect(names).toEqual(["PHC Mahodiya", "District Hospital"]);
    expect(res.body.data.services[0]).toMatchObject({
      source: "curated",
      phones: ["07562-000000"],
    });
    expect(res.body.data.services[0].distanceM).toBeLessThan(res.body.data.services[1].distanceM);
    expect(res.body.data.placesUsed).toBe(false);
  });

  it("falls back to Places when fewer than 3 curated results, skipping duplicates", async () => {
    await EmergencyService.create(service());
    const calls = [];
    const api = appWithPlaces(
      [
        {
          id: "gp1",
          displayName: { text: "City Hospital" },
          formattedAddress: "Sehore",
          location: { latitude: 23.25, longitude: 77.1 },
          nationalPhoneNumber: "07562 111111",
        },
        {
          id: "dup",
          displayName: { text: "District Hospital Sehore" },
          location: { latitude: 23.2101, longitude: 77.0901 }, // same place as the curated one
        },
      ],
      calls,
    );
    const res = await api()
      .get("/api/v1/emergency/nearby")
      .query({ ...HERE, type: "hospital" });
    expect(res.body.data.placesUsed).toBe(true);
    expect(res.body.data.services.map((s) => [s.source, s.name.en])).toEqual([
      ["curated", "District Hospital"],
      ["google", "City Hospital"],
    ]);
    expect(res.body.data.services[1]).toMatchObject({ id: "place:gp1", phones: ["07562 111111"] });
    expect(calls[0].url).toContain("places.googleapis.com");
    expect(calls[0].init.headers["X-Goog-Api-Key"]).toBe("places-key");
    const body = JSON.parse(calls[0].init.body);
    expect(body.includedTypes).toEqual(["hospital"]);
    // Nothing from Places is stored.
    expect(await EmergencyService.countDocuments()).toBe(1);
  });

  it("doesn't call Places with enough curated results, without a key, or for ambulance", async () => {
    await EmergencyService.create([
      service(),
      service({ name: { hi: "2", en: "Two" } }),
      service({ name: { hi: "3", en: "Three" } }),
    ]);
    const calls = [];
    const api = appWithPlaces([], calls);
    await api()
      .get("/api/v1/emergency/nearby")
      .query({ ...HERE, type: "hospital" });
    await api()
      .get("/api/v1/emergency/nearby")
      .query({ ...HERE, type: "ambulance" });
    expect(calls).toHaveLength(0);
    const { api: noKey } = makeApp();
    const res = await noKey()
      .get("/api/v1/emergency/nearby")
      .query({ ...HERE, type: "fire" });
    expect(res.body.data).toMatchObject({ services: [], placesUsed: false, approximate: false });
  });

  it("without a location uses the signed-in user's village; guests must send one", async () => {
    await EmergencyService.create(service());
    await createUser({ phone: "+919876543210", jurisdictionId: j.village._id });
    const { api } = makeApp();
    const as = await loginAs(api, "9876543210");
    const res = await as("get", "/emergency/nearby").query({ type: "hospital" });
    expect(res.body.data).toMatchObject({ approximate: true, from: HERE });
    expect(res.body.data.services).toHaveLength(1);
    expect((await api().get("/api/v1/emergency/nearby").query({ type: "hospital" })).status).toBe(
      400,
    );
  });

  it("validates the query and serves helplines", async () => {
    const { api } = makeApp();
    const bad = await api()
      .get("/api/v1/emergency/nearby")
      .query({ lat: 51.5, lng: 0, type: "hospital" });
    expect(bad.status).toBe(400);
    const typo = await api()
      .get("/api/v1/emergency/nearby")
      .query({ ...HERE, type: "temple" });
    expect(typo.status).toBe(400);
    const h = await api().get("/api/v1/emergency/helplines");
    expect(h.body.data.map((x) => x.number)).toContain("112");
  });
});

describe("admin emergency directory (docs/03 A-10)", () => {
  const body = (over = {}) => ({
    name: { hi: "दमकल सीहोर", en: "Fire station Sehore" },
    type: "fire",
    address: { hi: "सीहोर", en: "Sehore" },
    phones: ["101", "07562-222222"],
    lat: 23.2,
    lng: 77.085,
    is24x7: true,
    verifiedOn: "2026-09-20",
    active: true,
    ...over,
  });

  it("creates, lists with distance from the pilot village, edits, audits", async () => {
    const { api } = makeApp();
    const as = await loginAs(api, "9000000001");
    const created = await as("post", "/admin/emergency-services").send(body());
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ type: "fire", active: true });
    const doc = await EmergencyService.findById(created.body.data.id).lean();
    expect(String(doc.verifiedBy)).toBe(String(admin._id));
    expect(String(doc.jurisdictionId)).toBe(String(j.village._id));

    const list = await as("get", "/admin/emergency-services");
    expect(list.body.data[0].distanceM).toBeGreaterThan(400);
    expect(list.body.data[0].distanceM).toBeLessThan(600);

    const edited = await as("patch", `/admin/emergency-services/${created.body.data.id}`).send(
      body({ active: false }),
    );
    expect(edited.body.data.active).toBe(false);
    expect((await AuditLog.find({}).lean()).map((a) => a.action)).toEqual([
      "emergency.created",
      "emergency.updated",
    ]);
  });

  it("refuses a future verification date", async () => {
    const { api } = makeApp();
    const as = await loginAs(api, "9000000001");
    const res = await as("post", "/admin/emergency-services").send(
      body({ verifiedOn: "2999-01-01" }),
    );
    expect(res.status).toBe(400);
  });

  it("imports CSV all-or-nothing and offers a template", async () => {
    const { api } = makeApp();
    const as = await loginAs(api, "9000000001");
    const tpl = await as("get", "/admin/emergency-services/template.csv");
    expect(tpl.headers["content-type"]).toMatch(/text\/csv/);
    const header = tpl.text.replace(/^\uFEFF/, "").split("\r\n")[0];
    const good = `${header}\n"थाना, दोराहा",Police Doraha,police,दोराहा,Doraha,100;07562-3,23.21,77.1,yes,,,2026-09-01`;
    const bad = `${good}\nX,Y,temple,a,b,1,23.2,77.1,no,,,2026-09-01`;
    const rejected = await as("post", "/admin/emergency-services/import").send({ csv: bad });
    expect(rejected.status).toBe(400);
    expect(rejected.body.error.details[0].field).toMatch(/^row 3/);
    expect(await EmergencyService.countDocuments()).toBe(0);

    const ok = await as("post", "/admin/emergency-services/import").send({ csv: good });
    expect(ok.body.data).toEqual({ imported: 1 });
    const s = await EmergencyService.findOne({}).lean();
    expect(s.name.hi).toBe("थाना, दोराहा");
    expect(s.phones).toEqual(["100", "07562-3"]);
    expect(s.is24x7).toBe(true);

    const noCols = await as("post", "/admin/emergency-services/import").send({ csv: "a,b\n1,2" });
    expect(noCols.status).toBe(400);
  });

  it("is admin only", async () => {
    await createUser({ phone: "+919876543210", jurisdictionId: j.village._id });
    const { api } = makeApp();
    const as = await loginAs(api, "9876543210");
    expect((await as("get", "/admin/emergency-services")).status).toBe(403);
  });
});

describe("emergency seed (doc 06 task 4D.2)", () => {
  it("upserts verified rows by name + type", async () => {
    const csv =
      "name_hi,name_en,type,address_hi,address_en,phones,lat,lng,is24x7,notes_hi,notes_en,verified_on\n" +
      "जिला अस्पताल,District Hospital,hospital,सीहोर,Sehore,07562-1,23.2,77.08,yes,ब्लड बैंक,Blood bank,2026-09-01\n";
    expect(await seedEmergencyServices(csv)).toEqual({ created: 1, updated: 0 });
    expect(await seedEmergencyServices(csv)).toEqual({ created: 0, updated: 1 });
    const s = await EmergencyService.findOne({}).lean();
    expect(s.notes).toEqual({ hi: "ब्लड बैंक", en: "Blood bank" });
    await expect(seedEmergencyServices(csv.replace("2026-09-01", ""))).rejects.toThrow(/row 2/);
  });
});
