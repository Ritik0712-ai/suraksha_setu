import { beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { useTestDb } from "../helpers/db.js";
import { createUser, seedJurisdictions } from "../helpers/app.js";
import * as models from "../../src/models/index.js";
import { MAX_LOCATION_HISTORY } from "../../src/models/SosAlert.js";
import { DONATION_GAP_DAYS } from "../../src/models/BloodDonor.js";

const {
  BloodDonor,
  ChatSession,
  Complaint,
  Counter,
  Department,
  EmergencyService,
  Scheme,
  SosAlert,
  UsageEvent,
  User,
} = models;

useTestDb();

const point = (lng = 77.08, lat = 23.2) => ({ type: "Point", coordinates: [lng, lat] });
const t = (en) => ({ en, hi: `${en} (hi)` });
const oid = () => new mongoose.Types.ObjectId();

let j;
beforeEach(async () => {
  j = await seedJurisdictions();
});

describe("collections (docs/05 §3)", () => {
  it("registers all 19 collections under their documented names", () => {
    const names = Object.values(models)
      .map((m) => m.collection.collectionName)
      .sort();
    expect(names).toEqual(
      [
        "audit_logs",
        "blood_donors",
        "chat_messages",
        "chat_sessions",
        "complaints",
        "counters",
        "departments",
        "donor_contact_requests",
        "emergency_services",
        "jurisdictions",
        "notifications",
        "password_resets",
        "saved_schemes",
        "schemes",
        "sessions",
        "sos_alerts",
        "uploads",
        "usage_events",
        "users",
      ].sort(),
    );
  });

  it("creates the TTL and geo indexes from docs/05 §6", async () => {
    const byName = async (m) => (await m.collection.indexes()).map((i) => i.key);
    expect(await byName(SosAlert)).toContainEqual({ lastLocation: "2dsphere" });
    expect(await byName(BloodDonor)).toContainEqual({
      location: "2dsphere",
      bloodGroup: 1,
      available: 1,
      eligibleFrom: 1,
    });
    const ttl = (await UsageEvent.collection.indexes()).find((i) => i.expireAfterSeconds);
    expect(ttl).toMatchObject({ key: { createdAt: 1 }, expireAfterSeconds: 365 * 24 * 3600 });
  });
});

describe("shared sub-schemas", () => {
  it("rejects coordinates outside India", async () => {
    const svc = new EmergencyService({
      name: t("District Hospital"),
      type: "hospital",
      address: t("Sehore"),
      phones: ["07562-222222"],
      location: point(-0.12, 51.5), // London
      jurisdictionId: j.district._id,
      verifiedAt: new Date(),
      verifiedBy: oid(),
    });
    await expect(svc.validate()).rejects.toThrow(/outside_india/);
  });
});

describe("users.emergencyContacts (docs/05 §1.3)", () => {
  const contact = (phone) => ({ name: "Maa", relation: "mother", phone });

  it("allows up to 5 unique contacts that aren't the user's own number", async () => {
    const u = await createUser({ jurisdictionId: j.village._id, phone: "+919876543210" });
    u.emergencyContacts = ["1", "2", "3", "4", "5"].map((d) => contact(`+91987654000${d}`));
    await expect(u.save()).resolves.toBeTruthy();

    u.emergencyContacts.push(contact("+919876540006"));
    await expect(u.save()).rejects.toThrow(/too_many_contacts/);
  });

  it("rejects the user's own number and duplicates", async () => {
    const u = await createUser({ jurisdictionId: j.village._id, phone: "+919876543210" });
    u.emergencyContacts = [contact("+919876543210")];
    await expect(u.save()).rejects.toThrow(/invalid_contacts/);
    u.emergencyContacts = [contact("+919111111111"), contact("+919111111111")];
    await expect(u.save()).rejects.toThrow(/invalid_contacts/);
  });

  it("requires jurisdictions for authority accounts", async () => {
    await expect(
      createUser({
        role: "authority",
        jurisdictionId: j.village._id,
        authority: { jurisdictionIds: [] },
      }),
    ).rejects.toThrow(/authority_requires_jurisdictions/);
  });
});

describe("complaints (docs/05 §5.6)", () => {
  const base = async (over = {}) => ({
    complaintNo: "SS-2026-000001",
    citizenId: oid(),
    category: "water_supply",
    categorySource: "ai_accepted",
    location: point(),
    jurisdictionId: j.village._id,
    jurisdictionAncestors: [j.village._id, j.gp._id],
    departmentId: oid(),
    timeline: [
      { type: "created", toStatus: "SUBMITTED", visibility: "public", actorRole: "citizen" },
    ],
    ...over,
  });

  it("defaults onBehalfOf, rejection and aiSuggestion to null, and status to SUBMITTED", async () => {
    const c = await Complaint.create(await base());
    expect(c.onBehalfOf).toBeNull();
    expect(c.rejection).toBeNull();
    expect(c.aiSuggestion).toBeNull();
    expect(c.status).toBe("SUBMITTED");
  });

  it("enforces the complaint number format and uniqueness", async () => {
    await expect(Complaint.create(await base({ complaintNo: "SS-26-1" }))).rejects.toThrow();
    await Complaint.create(await base());
    await expect(Complaint.create(await base())).rejects.toThrow(/duplicate key/);
  });

  it("shows citizens only public timeline events", async () => {
    const c = await Complaint.create(
      await base({
        assigneeId: oid(),
        timeline: [
          { type: "created", toStatus: "SUBMITTED", visibility: "public", actorRole: "citizen" },
          {
            type: "internal_note",
            text: "Call the sachiv",
            visibility: "internal",
            actorRole: "authority",
          },
          {
            type: "public_note",
            text: "Team visiting Monday",
            visibility: "public",
            actorRole: "authority",
          },
        ],
      }),
    );
    const json = c.toCitizenJSON();
    expect(json.timeline.map((e) => e.type)).toEqual(["created", "public_note"]);
    expect(json).not.toHaveProperty("assigneeId");
  });

  it("caps reopens at 2 and requires a non-empty timeline", async () => {
    await expect(Complaint.create(await base({ reopenCount: 3 }))).rejects.toThrow();
    await expect(Complaint.create(await base({ timeline: [] }))).rejects.toThrow(/timeline_length/);
  });
});

describe("sos_alerts (docs/05 §5.10)", () => {
  const sos = (userId, over = {}) => ({
    userId,
    startLocation: point(),
    lastLocation: point(),
    locationSource: "gps",
    jurisdictionId: j.village._id,
    jurisdictionAncestors: [j.village._id],
    trackTokenHash: new mongoose.Types.ObjectId().toHexString(),
    trackTokenExpiresAt: new Date(Date.now() + 86400000),
    triggeredAt: new Date(),
    lastUpdateAt: new Date(),
    ...over,
  });

  it("allows only one open (ACTIVE/ACKNOWLEDGED) SOS per user", async () => {
    const user = oid();
    await SosAlert.create(sos(user));
    await expect(SosAlert.create(sos(user, { status: "ACKNOWLEDGED" }))).rejects.toThrow(
      /duplicate key/,
    );
    // Closed ones don't count, and other users are unaffected.
    await SosAlert.create(sos(user, { status: "RESOLVED_SAFE" }));
    await SosAlert.create(sos(oid()));
    expect(await SosAlert.countDocuments()).toBe(3);
  });

  it("caps the location trail at 720 points", async () => {
    const at = new Date();
    const history = Array.from({ length: MAX_LOCATION_HISTORY + 1 }, () => ({
      point: point(),
      at,
    }));
    await expect(SosAlert.create(sos(oid(), { locationHistory: history }))).rejects.toThrow(
      /location_history_max/,
    );
  });
});

describe("blood_donors (docs/05 §5.11)", () => {
  const donor = (over = {}) => ({
    userId: oid(),
    bloodGroup: "O+",
    location: point(),
    jurisdictionId: j.village._id,
    displayName: "Rahul S.",
    consentAt: new Date(),
    ...over,
  });

  it("computes eligibleFrom as last donation + 90 days, or now if never donated", async () => {
    const last = new Date("2026-08-01T00:00:00Z");
    const d = await BloodDonor.create(donor({ lastDonatedAt: last }));
    expect(d.eligibleFrom.getTime() - last.getTime()).toBe(DONATION_GAP_DAYS * 86400000);

    const never = await BloodDonor.create(donor());
    expect(Math.abs(never.eligibleFrom - Date.now())).toBeLessThan(5000);

    // Recomputed when the last donation date changes.
    never.lastDonatedAt = last;
    await never.save();
    expect(never.eligibleFrom.getTime()).toBe(d.eligibleFrom.getTime());
  });

  it("rejects a future donation date and a second profile for the same user", async () => {
    await expect(
      BloodDonor.create(donor({ lastDonatedAt: new Date(Date.now() + 86400000) })),
    ).rejects.toThrow(/future_date/);
    const userId = oid();
    await BloodDonor.create(donor({ userId }));
    await expect(BloodDonor.create(donor({ userId }))).rejects.toThrow(/duplicate key/);
  });
});

describe("schemes (docs/05 §5.8)", () => {
  const scheme = (over = {}) => ({
    slug: "pm-kisan",
    name: t("PM-KISAN"),
    summary: t("Income support for farmers"),
    benefitShort: t("Money every year"),
    benefits: [t("Money in instalments")],
    eligibilityText: [t("Farmer families with land")],
    documents: [{ key: "aadhaar", label: t("Aadhaar card"), icon: "badge" }],
    howToApply: [t("Apply online or at a CSC")],
    whereToApply: [t("CSC centre, Sehore")],
    officialUrl: "https://pmkisan.gov.in",
    sourceName: "PM-KISAN portal",
    categories: ["farmers"],
    level: "central",
    createdBy: oid(),
    updatedBy: oid(),
    ...over,
  });

  it("can't be published until it has been verified", async () => {
    await expect(Scheme.create(scheme({ status: "published" }))).rejects.toThrow(
      /verification_required_to_publish/,
    );
    await expect(
      Scheme.create(scheme({ status: "published", lastVerifiedAt: new Date() })),
    ).resolves.toBeTruthy();
  });

  it("validates eligibility rules against the questionnaire values", async () => {
    const rule = (field, op, value) => ({
      all: [{ field, op, value, failReason: t("Not eligible") }],
    });
    await expect(
      Scheme.create(scheme({ rules: rule("ageBand", "in", ["21_40", "41_60"]) })),
    ).resolves.toBeTruthy();
    await expect(
      Scheme.create(scheme({ slug: "x-1", rules: rule("ageBand", "in", ["21_60"]) })),
    ).rejects.toThrow(/invalid_rule_value/);
    await expect(
      Scheme.create(scheme({ slug: "x-2", rules: rule("shoeSize", "eq", "9") })),
    ).rejects.toThrow();
    await expect(
      Scheme.create(scheme({ slug: "x-3", rules: rule("gender", "eq", ["female"]) })),
    ).rejects.toThrow(/invalid_rule_value/);
  });

  it("requires an https official link and a kebab-case slug", async () => {
    await expect(Scheme.create(scheme({ officialUrl: "http://pmkisan.gov.in" }))).rejects.toThrow();
    await expect(Scheme.create(scheme({ slug: "PM Kisan" }))).rejects.toThrow();
  });
});

describe("other collections", () => {
  it("chat sessions need a scheme in scheme_help mode and a letter type in letter mode", async () => {
    const base = { userId: oid(), title: "Ayushman card kaise banega?" };
    await expect(ChatSession.create({ ...base, mode: "scheme_help" })).rejects.toThrow(
      /scheme_required/,
    );
    await expect(ChatSession.create({ ...base, mode: "letter" })).rejects.toThrow(
      /letter_type_required/,
    );
    const s = await ChatSession.create({ ...base, mode: "general" });
    const days = (s.expireAt - s.lastMessageAt) / 86400000;
    expect(Math.round(days)).toBe(90);
  });

  it("usage events refuse free text in props", async () => {
    await expect(
      UsageEvent.create({ type: "eligibility_completed", props: { likelyCount: 4 } }),
    ).resolves.toBeTruthy();
    await expect(
      UsageEvent.create({ type: "eligibility_completed", props: { note: "x".repeat(200) } }),
    ).rejects.toThrow(/props_must_be_short_scalars/);
  });

  it("department codes are unique and upper-case", async () => {
    const d = { name: t("GP"), jurisdictionId: j.gp._id, handlesCategories: ["garbage"] };
    await Department.create({ ...d, code: "gp_mahodiya" });
    expect((await Department.findOne().lean()).code).toBe("GP_MAHODIYA");
    await expect(Department.create({ ...d, code: "GP_MAHODIYA" })).rejects.toThrow(/duplicate key/);
    await expect(Department.create({ ...d, code: "GP MAHODIYA" })).rejects.toThrow();
  });

  it("counters default to 0 before the first increment", async () => {
    await Counter.create({ _id: "x" });
    expect((await Counter.findById("x").lean()).seq).toBe(0);
    expect(await User.countDocuments()).toBe(0);
  });
});
