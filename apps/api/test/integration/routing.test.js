import { beforeEach, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { useTestDb } from "../helpers/db.js";
import { seedJurisdictions } from "../helpers/app.js";
import { Department } from "../../src/models/Department.js";
import { Jurisdiction } from "../../src/models/Jurisdiction.js";
import { resolveJurisdiction } from "../../src/services/jurisdictionResolver.js";
import { routeDepartment } from "../../src/services/departmentRouting.js";
import { seedDepartments } from "../../src/scripts/seedDepartments.js";
import { seedJurisdictionTree } from "../../src/scripts/seedJurisdictions.js";

useTestDb();

const ids = (list) => list.map(String);

describe("resolveJurisdiction (docs/05 §5.4)", () => {
  let j;
  let square;
  beforeEach(async () => {
    j = await seedJurisdictions(); // Mahodiya village centroid at (77.08, 23.2)
    // A second village with a real boundary: a ~2 km square around (77.30, 23.30).
    square = await Jurisdiction.create({
      name: { en: "Square Village", hi: "स्क्वेयर गाँव" },
      type: "village",
      parentId: j.gp._id,
      centroid: { type: "Point", coordinates: [77.3, 23.3] },
      boundary: {
        type: "Polygon",
        coordinates: [
          [
            [77.29, 23.29],
            [77.31, 23.29],
            [77.31, 23.31],
            [77.29, 23.31],
            [77.29, 23.29],
          ],
        ],
      },
    });
  });

  it("uses a village boundary that contains the point", async () => {
    const r = await resolveJurisdiction({ lng: 77.305, lat: 23.305 }, j.village._id);
    expect(r.matchedBy).toBe("boundary");
    expect(String(r.jurisdictionId)).toBe(String(square._id));
    expect(ids(r.jurisdictionAncestors)).toEqual(
      ids([square._id, j.gp._id, j.block._id, j.district._id, j.state._id]),
    );
  });

  it("falls back to the nearest village centroid within 5 km", async () => {
    const r = await resolveJurisdiction({ lng: 77.1, lat: 23.2 }, j.district._id); // ~2 km away
    expect(r.matchedBy).toBe("nearest");
    expect(String(r.jurisdictionId)).toBe(String(j.village._id));
  });

  it("uses the home jurisdiction when nothing is within 5 km or there is no location", async () => {
    const far = await resolveJurisdiction({ lng: 78.5, lat: 24.5 }, j.village._id);
    expect(far.matchedBy).toBe("home");
    expect(String(far.jurisdictionId)).toBe(String(j.village._id));

    const none = await resolveJurisdiction(null, j.district._id);
    expect(none.matchedBy).toBe("home");
    expect(ids(none.jurisdictionAncestors)).toEqual(ids([j.district._id, j.state._id]));
  });

  it("ignores inactive villages", async () => {
    await Jurisdiction.updateOne({ _id: square._id }, { active: false });
    const r = await resolveJurisdiction({ lng: 77.305, lat: 23.305 }, j.district._id);
    expect(r.matchedBy).toBe("home");
  });
});

describe("routeDepartment with the pilot seed (docs/05 §5.5, §11.2)", () => {
  let ancestors;
  let depts;

  beforeEach(async () => {
    const read = async (f) =>
      JSON.parse(await readFile(new URL(`../../seed/${f}`, import.meta.url), "utf8"));
    await seedJurisdictionTree((await read("jurisdictions.json")).tree);
    depts = await seedDepartments(await read("departments.json"));
    const village = await Jurisdiction.findOne({ type: "village", "name.en": "Mahodiya" });
    ancestors = village.selfAndAncestors();
  });

  const route = async (category) =>
    String((await routeDepartment(category, ancestors)).departmentId);

  it("sends handpumps to PHED and everything else to the Gram Panchayat (docs/02 §8.3)", async () => {
    expect(await route("water_supply")).toBe(String(depts.PHED_SEHORE));
    for (const c of [
      "road_damage",
      "garbage",
      "streetlight",
      "waterlogging",
      "encroachment",
      "other",
    ])
      expect(await route(c)).toBe(String(depts.GP_MAHODIYA));
  });

  it("never auto-routes to manual-only departments (PWD, Revenue)", async () => {
    await Department.updateOne({ code: "GP_MAHODIYA" }, { handlesCategories: ["garbage"] });
    // road_damage is now handled by nobody → village default (GP), not PWD.
    const r = await routeDepartment("road_damage", ancestors);
    expect(r).toEqual({ departmentId: depts.GP_MAHODIYA, matchedBy: "default" });
  });

  it("prefers the nearest level when several levels handle a category", async () => {
    const village = ancestors[0];
    const local = await Department.create({
      code: "VILLAGE_WATER_COMMITTEE",
      name: { en: "Village water committee", hi: "ग्राम जल समिति" },
      jurisdictionId: village,
      handlesCategories: ["water_supply"],
    });
    expect(await route("water_supply")).toBe(String(local._id));
  });

  it("skips inactive departments, falling back to the default, then to null", async () => {
    await Department.updateOne({ code: "PHED_SEHORE" }, { active: false });
    expect(await route("water_supply")).toBe(String(depts.GP_MAHODIYA)); // village default

    await Department.updateOne({ code: "GP_MAHODIYA" }, { active: false });
    expect(await routeDepartment("water_supply", ancestors)).toBeNull();
  });

  it("re-running the seed changes nothing", async () => {
    const read = async (f) =>
      JSON.parse(await readFile(new URL(`../../seed/${f}`, import.meta.url), "utf8"));
    const again = await seedDepartments(await read("departments.json"));
    expect(again).toEqual(depts);
    expect(await Department.countDocuments()).toBe(4);
  });
});
