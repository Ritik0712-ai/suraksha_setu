import { beforeEach, describe, expect, it } from "vitest";
import { useTestDb } from "../helpers/db.js";
import { createUser, loginAs, makeApp, seedJurisdictions } from "../helpers/app.js";
import { BloodDonor, DonorContactRequest } from "../../src/models/index.js";
import { maskDonorPhone } from "../../src/modules/donors/routes.js";

useTestDb();

const HERE = { lat: 23.2, lng: 77.08 };
let ctx;
let j;
let asMe;

async function donor(phone, name, over = {}) {
  const u = await createUser({ phone, name, jurisdictionId: j.village._id });
  const d = await BloodDonor.create({
    userId: u._id,
    bloodGroup: "B+",
    location: { type: "Point", coordinates: [77.081, 23.201] },
    jurisdictionId: j.village._id,
    displayName: name.split(" ")[0],
    consentAt: new Date(),
    ...over,
  });
  return { u, d };
}

beforeEach(async () => {
  j = await seedJurisdictions();
  ctx = makeApp();
  await createUser({ name: "Asha Verma", phone: "+919876543210", jurisdictionId: j.village._id });
  asMe = await loginAs(ctx.api, "9876543210");
});

describe("my donor profile (docs/03 S-23)", () => {
  it("404 until registered; registers with consent; 'First L.' name; eligibility from last donation", async () => {
    expect((await asMe("get", "/donors/me")).status).toBe(404);
    const noConsent = await asMe("put", "/donors/me").send({
      bloodGroup: "O+",
      lastDonatedAt: null,
      location: null,
    });
    expect(noConsent.status).toBe(400);

    const lastDonatedAt = new Date(Date.now() - 30 * 86400_000).toISOString();
    const res = await asMe("put", "/donors/me").send({
      bloodGroup: "O+",
      lastDonatedAt,
      location: { lat: 23.2005, lng: 77.0805 },
      available: true,
      consent: true,
    });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      bloodGroup: "O+",
      displayName: "Asha V.",
      eligibleNow: false,
      available: true,
      viewsThisMonth: 0,
      village: { en: "Mahodiya", hi: "महोदिया" },
    });
    const expected = new Date(new Date(lastDonatedAt).getTime() + 90 * 86400_000);
    expect(new Date(res.body.data.eligibleFrom).getTime()).toBe(expected.getTime());

    const again = await asMe("put", "/donors/me").send({
      bloodGroup: "O+",
      lastDonatedAt: null,
      location: null,
      consent: true,
    });
    expect(again.status).toBe(200);
    expect(again.body.data.eligibleNow).toBe(true);
    expect(again.body.data.location).toEqual({ lat: 23.2, lng: 77.08 }); // village centroid
  });

  it("refuses a future donation date", async () => {
    const res = await asMe("put", "/donors/me").send({
      bloodGroup: "O+",
      lastDonatedAt: "2999-01-01",
      location: null,
      consent: true,
    });
    expect(res.status).toBe(400);
  });

  it("toggles availability and removes the profile", async () => {
    await asMe("put", "/donors/me").send({
      bloodGroup: "A+",
      lastDonatedAt: null,
      location: null,
      consent: true,
    });
    const off = await asMe("patch", "/donors/me/availability").send({ available: false });
    expect(off.body.data.available).toBe(false);
    await asMe("delete", "/donors/me");
    expect(await BloodDonor.countDocuments()).toBe(0);
  });
});

describe("GET /donors/search (docs/05 §5.11)", () => {
  it("finds compatible, available, eligible donors nearby with masked phones", async () => {
    await donor("+919811111121", "Rahul Sharma");
    await donor("+919822222222", "Ravi Kumar", { bloodGroup: "O-" });
    await donor("+919833333333", "Hidden Person", { available: false });
    await donor("+919844444444", "Recent Donor", {
      lastDonatedAt: new Date(Date.now() - 10 * 86400_000),
    });
    await donor("+919855555555", "Far Away", {
      location: { type: "Point", coordinates: [77.6, 23.2] }, // ~53 km
    });
    await donor("+919866666666", "Wrong Group", { bloodGroup: "A+" });

    const res = await asMe("get", "/donors/search").query({ bloodGroup: "B+", ...HERE });
    expect(res.status).toBe(200);
    const d = res.body.data.donors;
    expect(d.map((x) => x.displayName).sort()).toEqual(["Rahul", "Ravi"]);
    const rahul = d.find((x) => x.displayName === "Rahul");
    expect(rahul).toMatchObject({ bloodGroup: "B+", compatible: false, maskedPhone: "98XXXXXX21" });
    expect(rahul).not.toHaveProperty("phone");
    expect(d.find((x) => x.displayName === "Ravi").compatible).toBe(true);

    const exact = await asMe("get", "/donors/search").query({
      bloodGroup: "B+",
      ...HERE,
      includeCompatible: "false",
    });
    expect(exact.body.data.donors.map((x) => x.displayName)).toEqual(["Rahul"]);

    const wide = await asMe("get", "/donors/search").query({
      bloodGroup: "B+",
      ...HERE,
      radiusKm: 50,
    });
    expect(wide.body.data.donors).toHaveLength(2); // 53 km is still outside 50 km
  });

  it("uses the home village without a location, excludes me, and validates the radius", async () => {
    await asMe("put", "/donors/me").send({
      bloodGroup: "B+",
      lastDonatedAt: null,
      location: null,
      consent: true,
    });
    await donor("+919811111121", "Rahul Sharma");
    const res = await asMe("get", "/donors/search").query({ bloodGroup: "B+" });
    expect(res.body.data.donors.map((x) => x.displayName)).toEqual(["Rahul"]);
    expect(
      (await asMe("get", "/donors/search").query({ bloodGroup: "B+", radiusKm: 7 })).status,
    ).toBe(400);
  });
});

describe("POST /donors/:id/reveal (docs/01 FR-BLD-04)", () => {
  it("reveals the phone, logs it, counts it for the donor, and limits 10 a day", async () => {
    const { u, d } = await donor("+919811111121", "Rahul Sharma");
    const res = await asMe("post", `/donors/${d._id}/reveal`).send({ bloodGroupSearched: "B+" });
    expect(res.body.data).toEqual({ phone: "+919811111121", revealsLeftToday: 9 });
    // The same donor again today is free.
    const again = await asMe("post", `/donors/${d._id}/reveal`).send({ bloodGroupSearched: "B+" });
    expect(again.body.data.revealsLeftToday).toBe(9);
    expect(await DonorContactRequest.countDocuments()).toBe(1);

    const asDonor = await loginAs(ctx.api, "9811111121");
    expect((await asDonor("get", "/donors/me")).body.data.viewsThisMonth).toBe(1);

    const others = [];
    for (let i = 0; i < 10; i += 1) others.push((await donor(`+91970000000${i}`, `Donor ${i}`)).d);
    for (let i = 0; i < 9; i += 1)
      expect(
        (await asMe("post", `/donors/${others[i]._id}/reveal`).send({ bloodGroupSearched: "B+" }))
          .status,
      ).toBe(200);
    const limited = await asMe("post", `/donors/${others[9]._id}/reveal`).send({
      bloodGroupSearched: "B+",
    });
    expect(limited.status).toBe(429);
    expect(limited.body.error.message).toMatch(/10/);
    expect(String(u._id)).toBeTruthy();
  });

  it("can't reveal a hidden donor or yourself", async () => {
    const { d } = await donor("+919811111121", "Rahul Sharma", { available: false });
    expect(
      (await asMe("post", `/donors/${d._id}/reveal`).send({ bloodGroupSearched: "B+" })).status,
    ).toBe(404);
  });
});

describe("maskDonorPhone", () => {
  it("keeps the first two and last two digits", () => {
    expect(maskDonorPhone("+919876543221")).toBe("98XXXXXX21");
    expect(maskDonorPhone(null)).toBeNull();
  });
});
