import { beforeEach, describe, expect, it } from "vitest";
import { useTestDb } from "../helpers/db.js";
import { createUser, loginAs, makeApp, seedJurisdictions } from "../helpers/app.js";
import { AuditLog, BloodDonor } from "../../src/models/index.js";

// docs/05 §8 permissions matrix — one check per row and role (docs/06 Phase 6: "all
// permission-matrix rows have a test"). Behaviour behind an allowed door (scope, ownership,
// limits) is tested in each module's own file; this file proves who may knock at all.

useTestDb();

const ID = "0123456789abcdef01234567"; // any valid id: role checks run before any lookup
let ctx;
let as;
let j;

beforeEach(async () => {
  j = await seedJurisdictions();
  ctx = makeApp();
  await createUser({ name: "Sunita Devi", phone: "+919876543210", jurisdictionId: j.village._id });
  await createUser({
    role: "authority",
    name: "GP Secretary",
    phone: "+919000000101",
    jurisdictionId: j.village._id,
    authority: { jurisdictionIds: [j.gp._id], departmentId: null },
  });
  await createUser({
    role: "admin",
    name: "Admin One",
    phone: "+919000000001",
    jurisdictionId: j.village._id,
  });
  as = {
    public: (method, path) => ctx.api()[method](`/api/v1${path}`),
    citizen: await loginAs(ctx.api, "9876543210"),
    authority: await loginAs(ctx.api, "9000000101"),
    admin: await loginAs(ctx.api, "9000000001"),
  };
});

/** [row, method, path, { public, citizen, authority, admin }] — "ok" = not 401/403. */
const ROWS = [
  ["own profile", "get", "/auth/me", { public: 401, citizen: "ok", authority: "ok", admin: "ok" }],
  [
    "other users",
    "get",
    "/admin/users",
    { public: 401, citizen: 403, authority: 403, admin: "ok" },
  ],
  [
    "create accounts",
    "post",
    "/admin/users",
    { public: 401, citizen: 403, authority: 403, admin: "ok" },
  ],
  [
    "emergency contacts",
    "get",
    "/users/me/contacts",
    { public: 401, citizen: "ok", authority: 403, admin: 403 },
  ],
  ["SOS trigger", "post", "/sos", { public: 401, citizen: "ok", authority: 403, admin: 403 }],
  [
    "SOS own history",
    "get",
    "/sos/mine",
    { public: 401, citizen: "ok", authority: 403, admin: 403 },
  ],
  [
    "SOS location",
    "post",
    `/sos/${ID}/location`,
    { public: 401, citizen: "ok", authority: 403, admin: 403 },
  ],
  [
    "SOS resolve",
    "post",
    `/sos/${ID}/resolve`,
    { public: 401, citizen: "ok", authority: 403, admin: 403 },
  ],
  [
    "SOS read (staff list)",
    "get",
    "/sos/active",
    { public: 401, citizen: 403, authority: "ok", admin: "ok" },
  ],
  [
    "SOS acknowledge",
    "post",
    `/sos/${ID}/acknowledge`,
    { public: 401, citizen: 403, authority: "ok", admin: "ok" },
  ],
  [
    "SOS close",
    "post",
    `/sos/${ID}/close`,
    { public: 401, citizen: 403, authority: "ok", admin: "ok" },
  ],
  [
    "SOS reveal phone",
    "post",
    `/sos/${ID}/reveal-phone`,
    { public: 401, citizen: 403, authority: "ok", admin: "ok" },
  ],
  [
    "track page (public)",
    "get",
    "/track/not-a-real-token",
    { public: "ok", citizen: "ok", authority: "ok", admin: "ok" },
  ],
  [
    "complaint create",
    "post",
    "/complaints",
    { public: 401, citizen: "ok", authority: 403, admin: 403 },
  ],
  [
    "complaint own list",
    "get",
    "/complaints/mine",
    { public: 401, citizen: "ok", authority: 403, admin: 403 },
  ],
  [
    "complaint staff list",
    "get",
    "/complaints",
    { public: 401, citizen: 403, authority: "ok", admin: "ok" },
  ],
  [
    "complaint status",
    "patch",
    `/complaints/${ID}/status`,
    { public: 401, citizen: 403, authority: "ok", admin: "ok" },
  ],
  [
    "complaint assign",
    "patch",
    `/complaints/${ID}/assign`,
    { public: 401, citizen: 403, authority: "ok", admin: "ok" },
  ],
  [
    "complaint notes",
    "post",
    `/complaints/${ID}/notes`,
    { public: 401, citizen: 403, authority: "ok", admin: "ok" },
  ],
  [
    "complaint re-categorise",
    "patch",
    `/complaints/${ID}/category`,
    { public: 401, citizen: 403, authority: "ok", admin: "ok" },
  ],
  [
    "complaint reopen",
    "post",
    `/complaints/${ID}/reopen`,
    { public: 401, citizen: "ok", authority: 403, admin: 403 },
  ],
  [
    "complaints CSV",
    "get",
    "/complaints/export.csv",
    { public: 401, citizen: 403, authority: "ok", admin: "ok" },
  ],
  [
    "complainant phone",
    "post",
    `/complaints/${ID}/reveal-phone`,
    { public: 401, citizen: 403, authority: "ok", admin: "ok" },
  ],
  [
    "schemes read (published)",
    "get",
    "/schemes",
    { public: "ok", citizen: "ok", authority: "ok", admin: "ok" },
  ],
  [
    "schemes admin",
    "get",
    "/admin/schemes",
    { public: 401, citizen: 403, authority: 403, admin: "ok" },
  ],
  [
    "scheme create",
    "post",
    "/admin/schemes",
    { public: 401, citizen: 403, authority: 403, admin: "ok" },
  ],
  [
    "eligibility check",
    "post",
    "/schemes/eligibility",
    { public: "ok", citizen: "ok", authority: "ok", admin: "ok" },
  ],
  [
    "saved schemes",
    "get",
    "/users/me/saved-schemes",
    { public: 401, citizen: "ok", authority: 403, admin: 403 },
  ],
  [
    "donor profile",
    "get",
    "/donors/me",
    { public: 401, citizen: "ok", authority: 403, admin: 403 },
  ],
  [
    "donor search",
    "get",
    "/donors/search?bloodGroup=O%2B",
    { public: 401, citizen: "ok", authority: 403, admin: "ok" },
  ],
  [
    "donor reveal",
    "post",
    `/donors/${ID}/reveal`,
    { public: 401, citizen: "ok", authority: 403, admin: "ok" },
  ],
  [
    "donor remove (abuse)",
    "delete",
    `/donors/${ID}`,
    { public: 401, citizen: 403, authority: 403, admin: "ok" },
  ],
  [
    "helplines",
    "get",
    "/emergency/helplines",
    { public: "ok", citizen: "ok", authority: "ok", admin: "ok" },
  ],
  [
    "nearby services",
    "get",
    "/emergency/nearby?lat=23.2&lng=77.08&type=hospital",
    { public: "ok", citizen: "ok", authority: "ok", admin: "ok" },
  ],
  [
    "emergency directory",
    "get",
    "/admin/emergency-services",
    { public: 401, citizen: 403, authority: 403, admin: "ok" },
  ],
  [
    "departments CRUD",
    "post",
    "/admin/departments",
    { public: 401, citizen: 403, authority: 403, admin: "ok" },
  ],
  [
    "jurisdictions CRUD",
    "post",
    "/admin/jurisdictions",
    { public: 401, citizen: 403, authority: 403, admin: "ok" },
  ],
  [
    "Sahayak chat",
    "get",
    "/chat/sessions",
    { public: 401, citizen: "ok", authority: 403, admin: 403 },
  ],
  [
    "Sahayak message",
    "post",
    `/chat/sessions/${ID}/messages`,
    { public: 401, citizen: "ok", authority: 403, admin: 403 },
  ],
  [
    "notifications",
    "get",
    "/notifications",
    { public: 401, citizen: "ok", authority: "ok", admin: "ok" },
  ],
  [
    "overview",
    "get",
    "/admin/overview",
    { public: 401, citizen: 403, authority: "ok", admin: "ok" },
  ],
  [
    "analytics",
    "get",
    "/admin/analytics?from=2026-09-01&to=2026-09-27",
    { public: 401, citizen: 403, authority: "ok", admin: "ok" },
  ],
  [
    "audit log",
    "get",
    "/admin/audit-logs",
    { public: 401, citizen: 403, authority: 403, admin: "ok" },
  ],
  [
    "reset code",
    "post",
    `/admin/users/${ID}/reset-code`,
    { public: 401, citizen: 403, authority: 403, admin: "ok" },
  ],
];

describe("docs/05 §8 permissions matrix", () => {
  it.each(ROWS)("%s — %s %s", async (_row, method, path, expected) => {
    for (const [role, want] of Object.entries(expected)) {
      const res = await as[role](method, path).send({});
      if (want === "ok") expect([401, 403], `${role} should be allowed`).not.toContain(res.status);
      else expect(res.status, `${role} → ${res.status}`).toBe(want);
    }
  });
});

describe("admin donor tools (docs/05 §8: search, reveal, remove for abuse)", () => {
  it("admin removes a donor profile and it is audited", async () => {
    const donorUser = await createUser({
      name: "Ravi Kumar",
      phone: "+919811100000",
      jurisdictionId: j.village._id,
    });
    const d = await BloodDonor.create({
      userId: donorUser._id,
      bloodGroup: "O+",
      location: { type: "Point", coordinates: [77.08, 23.2] },
      jurisdictionId: donorUser.jurisdictionId,
      displayName: "Ravi K.",
      consentAt: new Date(),
    });
    const res = await as.admin("delete", `/donors/${d._id}`).send({});
    expect(res.status).toBe(200);
    expect(await BloodDonor.countDocuments()).toBe(0);
    expect(await AuditLog.findOne({ action: "donor.removed" }).lean()).toBeTruthy();
    expect((await as.admin("delete", `/donors/${d._id}`).send({})).status).toBe(404);
  });
});
