import { Router } from "express";
import { z } from "zod";
import C from "../../config/constants.js";
import { audit } from "../../lib/audit.js";
import { AppError } from "../../lib/errors.js";
import { hashPassword, tempPassword } from "../../lib/password.js";
import { maskPhone } from "../../lib/phone.js";
import { invalidateUser } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { AuditLog } from "../../models/AuditLog.js";
import { Department } from "../../models/Department.js";
import { Jurisdiction } from "../../models/Jurisdiction.js";
import { Session } from "../../models/Session.js";
import { User } from "../../models/User.js";
import { routeDepartment } from "../../services/departmentRouting.js";
import { email, objectId, personName, phone } from "../auth/schemas.js";
import { localized } from "../schemes/adminSchemas.js";

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);
const idParam = { params: z.object({ id: objectId }) };
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// --- users (docs/03 A-07) ---------------------------------------------------------------------

const staffRoles = ["authority", "admin"];

const userListQuery = z.object({
  role: z.enum(C.roles).optional(),
  q: z.string().trim().max(60).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
});

const createUserBody = z
  .object({
    name: personName,
    phone,
    email: email.nullable().optional(),
    role: z.enum(staffRoles),
    title: z.string().trim().max(80).optional(),
    jurisdictionIds: z.array(objectId).max(20).default([]),
    departmentId: objectId.nullable().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.role === "authority" && !v.jurisdictionIds.length)
      ctx.addIssue({ code: "custom", path: ["jurisdictionIds"], message: "required" });
  });

const updateUserBody = z.object({
  role: z.enum(staffRoles).optional(),
  title: z.string().trim().max(80).nullable().optional(),
  jurisdictionIds: z.array(objectId).max(20).optional(),
  departmentId: objectId.nullable().optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

async function userRows(users) {
  const jurIds = users.flatMap((u) => [u.jurisdictionId, ...(u.authority?.jurisdictionIds ?? [])]);
  const deptIds = users.map((u) => u.authority?.departmentId).filter(Boolean);
  const [jurs, depts] = await Promise.all([
    Jurisdiction.find({ _id: { $in: jurIds } })
      .select("name type")
      .lean(),
    Department.find({ _id: { $in: deptIds } })
      .select("name code")
      .lean(),
  ]);
  const j = new Map(jurs.map((x) => [String(x._id), x]));
  const d = new Map(depts.map((x) => [String(x._id), x]));
  return users.map((u) => ({
    id: String(u._id),
    name: u.name,
    maskedPhone: maskPhone(u.phone),
    email: u.email ?? null,
    role: u.role,
    status: u.status,
    title: u.authority?.title ?? null,
    village: j.get(String(u.jurisdictionId))?.name ?? null,
    jurisdictions: (u.authority?.jurisdictionIds ?? []).map((id) => ({
      id: String(id),
      name: j.get(String(id))?.name ?? null,
      type: j.get(String(id))?.type ?? null,
    })),
    department: u.authority?.departmentId
      ? {
          id: String(u.authority.departmentId),
          name: d.get(String(u.authority.departmentId))?.name ?? null,
        }
      : null,
    mustChangePassword: Boolean(u.mustChangePassword),
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt ?? null,
  }));
}

async function checkRefs({ jurisdictionIds = [], departmentId }) {
  if (jurisdictionIds.length) {
    const n = await Jurisdiction.countDocuments({ _id: { $in: jurisdictionIds }, active: true });
    if (n !== new Set(jurisdictionIds).size)
      throw new AppError("VALIDATION_ERROR", "validation", [
        { field: "jurisdictionIds", issue: "invalid" },
      ]);
  }
  if (departmentId && !(await Department.exists({ _id: departmentId, active: true })))
    throw new AppError("VALIDATION_ERROR", "validation", [
      { field: "departmentId", issue: "invalid" },
    ]);
}

function usersRouter({ bcryptCost }) {
  const router = Router();

  router.get(
    "/",
    validate({ query: userListQuery }),
    wrap(async (req, res) => {
      const { role, q, page } = req.validatedQuery;
      const filter = { status: { $ne: "deleted" } };
      if (role) filter.role = role;
      if (q) {
        const digits = q.replace(/\D/g, "");
        filter.$or = [{ name: { $regex: escapeRegex(q), $options: "i" } }];
        if (digits.length >= 4) filter.$or.push({ phone: { $regex: escapeRegex(digits) } });
      }
      const PAGE = 50;
      const [users, total] = await Promise.all([
        User.find(filter)
          .sort({ createdAt: -1 })
          .skip((page - 1) * PAGE)
          .limit(PAGE)
          .lean(),
        User.countDocuments(filter),
      ]);
      res.json({ data: { items: await userRows(users), total, page } });
    }),
  );

  // Temporary password shown once; changed at first login (docs/03 A-07, A-14).
  router.post(
    "/",
    validate({ body: createUserBody }),
    wrap(async (req, res) => {
      const b = req.body;
      await checkRefs(b);
      if (await User.exists({ phone: b.phone, status: { $ne: "deleted" } }))
        throw new AppError("CONFLICT", "phone_taken", [{ field: "phone", issue: "taken" }]);
      const password = tempPassword();
      const home = b.jurisdictionIds[0] ?? req.user.jurisdictionId;
      const user = await User.create({
        name: b.name,
        phone: b.phone,
        email: b.email ?? null,
        passwordHash: await hashPassword(password, bcryptCost),
        role: b.role,
        jurisdictionId: home,
        authority:
          b.role === "authority"
            ? {
                title: b.title,
                jurisdictionIds: b.jurisdictionIds,
                departmentId: b.departmentId ?? null,
              }
            : null,
        mustChangePassword: true,
        consent: { version: C.consentVersion, acceptedAt: new Date() },
      });
      await audit(req, {
        action: "user.created",
        targetType: "users",
        targetId: user._id,
        changes: { role: [null, b.role] },
      });
      const [row] = await userRows([user.toObject()]);
      res.status(201).json({ data: { user: row, tempPassword: password } });
    }),
  );

  router.patch(
    "/:id",
    validate({ ...idParam, body: updateUserBody }),
    wrap(async (req, res) => {
      const u = await User.findById(req.params.id);
      if (!u || u.status === "deleted") throw new AppError("NOT_FOUND", "user_not_found");
      const b = req.body;
      if (String(u._id) === String(req.user._id) && (b.status === "inactive" || b.role))
        throw new AppError("CONFLICT", "cannot_change_self");
      if (u.role === "citizen" && (b.role || b.jurisdictionIds || b.departmentId !== undefined))
        throw new AppError("VALIDATION_ERROR", "validation", [{ field: "role", issue: "invalid" }]);
      await checkRefs(b);

      const before = { role: u.role, status: u.status };
      if (b.status) u.status = b.status;
      if (b.role) u.role = b.role;
      if (u.role === "authority") {
        const current = u.authority?.toObject?.() ?? {};
        u.authority = {
          title: b.title !== undefined ? b.title : current.title,
          jurisdictionIds: b.jurisdictionIds ?? current.jurisdictionIds ?? [],
          departmentId:
            b.departmentId !== undefined ? b.departmentId : (current.departmentId ?? null),
        };
      } else if (u.role === "admin") u.authority = null;
      // Role, scope or status changes take effect at once: old tokens stop working.
      const securityChange =
        b.status || b.role || b.jurisdictionIds || b.departmentId !== undefined;
      if (securityChange) u.tokenVersion += 1;
      await u.save();
      if (securityChange) {
        invalidateUser(u._id);
        if (u.status === "inactive") await Session.deleteMany({ userId: u._id });
      }
      await audit(req, {
        action:
          b.status && b.status !== before.status
            ? `user.${b.status === "active" ? "reactivated" : "deactivated"}`
            : "user.updated",
        targetType: "users",
        targetId: u._id,
        changes: {
          ...(b.role && b.role !== before.role ? { role: [before.role, b.role] } : {}),
          ...(b.status && b.status !== before.status ? { status: [before.status, b.status] } : {}),
        },
      });
      const [row] = await userRows([u.toObject()]);
      res.json({ data: row });
    }),
  );

  return router;
}

// --- departments (docs/03 A-11) ---------------------------------------------------------------

const departmentBody = z.object({
  name: localized(120),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9_]+$/, "invalid")
    .max(40),
  jurisdictionId: objectId,
  handlesCategories: z.array(z.enum(C.complaintCategories)).default([]),
  contactPhone: z.string().trim().max(20).nullable().optional(),
  contactEmail: email.nullable().optional(),
  active: z.boolean().default(true),
});

/** Categories that fall back to a default (or nowhere) per active village — the A-11 warning. */
async function routingGaps() {
  const villages = await Jurisdiction.find({ type: "village", active: true }).limit(50);
  const gaps = [];
  for (const v of villages) {
    for (const category of C.complaintCategories) {
      const r = await routeDepartment(category, v.selfAndAncestors());
      if (!r || r.matchedBy === "default")
        gaps.push({ villageId: String(v._id), village: v.name, category, fallback: Boolean(r) });
    }
  }
  return gaps;
}

function departmentsRouter() {
  const router = Router();

  router.get(
    "/",
    wrap(async (_req, res) => {
      const list = await Department.find({}).sort({ code: 1 }).lean();
      const jurs = new Map(
        (
          await Jurisdiction.find({ _id: { $in: list.map((d) => d.jurisdictionId) } })
            .select("name type")
            .lean()
        ).map((j) => [String(j._id), j]),
      );
      res.json({
        data: {
          items: list.map((d) => ({
            id: String(d._id),
            name: d.name,
            code: d.code,
            jurisdictionId: String(d.jurisdictionId),
            jurisdiction: jurs.get(String(d.jurisdictionId))?.name ?? null,
            handlesCategories: d.handlesCategories,
            contactPhone: d.contactPhone ?? null,
            contactEmail: d.contactEmail ?? null,
            active: d.active,
          })),
          gaps: await routingGaps(),
        },
      });
    }),
  );

  const save = (existing) =>
    wrap(async (req, res) => {
      if (!(await Jurisdiction.exists({ _id: req.body.jurisdictionId })))
        throw new AppError("VALIDATION_ERROR", "validation", [
          { field: "jurisdictionId", issue: "invalid" },
        ]);
      let d;
      try {
        if (existing) {
          d = await Department.findById(req.params.id);
          if (!d) throw new AppError("NOT_FOUND");
          d.set(req.body);
          await d.save();
        } else d = await Department.create(req.body);
      } catch (err) {
        if (err?.code === 11000)
          throw new AppError("CONFLICT", "code_taken", [{ field: "code", issue: "taken" }]);
        throw err;
      }
      await audit(req, {
        action: existing ? "department.updated" : "department.created",
        targetType: "departments",
        targetId: d._id,
      });
      res.status(existing ? 200 : 201).json({ data: { id: String(d._id), code: d.code } });
    });

  router.post("/", validate({ body: departmentBody }), save(false));
  router.patch("/:id", validate({ ...idParam, body: departmentBody }), save(true));
  return router;
}

// --- jurisdictions (docs/03 A-12) -------------------------------------------------------------

const geoPolygon = z
  .object({
    type: z.enum(["Polygon", "MultiPolygon"]),
    coordinates: z.array(z.any()).min(1),
  })
  .nullable()
  .optional();

const jurisdictionBody = z.object({
  name: localized(80),
  type: z.enum(C.jurisdictionTypes),
  parentId: objectId.nullable(),
  lgdCode: z.string().trim().max(20).nullable().optional(),
  centroid: z.object({ lat: z.number().min(6).max(37.5), lng: z.number().min(68).max(97.5) }),
  boundary: geoPolygon,
  defaultDepartmentId: objectId.nullable().optional(),
  active: z.boolean().default(true),
});

const LEVEL = Object.fromEntries(C.jurisdictionTypes.map((t, i) => [t, i]));

function jurisdictionsRouter() {
  const router = Router();

  router.get(
    "/",
    wrap(async (_req, res) => {
      const list = await Jurisdiction.find({}).sort({ "name.en": 1 }).lean();
      res.json({
        data: list.map((j) => ({
          id: String(j._id),
          name: j.name,
          type: j.type,
          parentId: j.parentId ? String(j.parentId) : null,
          lgdCode: j.lgdCode ?? null,
          centroid: { lat: j.centroid.coordinates[1], lng: j.centroid.coordinates[0] },
          hasBoundary: Boolean(j.boundary),
          boundary: j.boundary ?? null,
          defaultDepartmentId: j.defaultDepartmentId ? String(j.defaultDepartmentId) : null,
          active: j.active,
        })),
      });
    }),
  );

  const save = (existing) =>
    wrap(async (req, res) => {
      const b = req.body;
      if (b.parentId) {
        const parent = await Jurisdiction.findById(b.parentId).select("type").lean();
        if (!parent || LEVEL[parent.type] >= LEVEL[b.type])
          throw new AppError("VALIDATION_ERROR", "validation", [
            { field: "parentId", issue: "invalid" },
          ]);
      } else if (b.type !== C.jurisdictionTypes[0])
        throw new AppError("VALIDATION_ERROR", "validation", [
          { field: "parentId", issue: "required" },
        ]);
      const doc = {
        name: b.name,
        type: b.type,
        parentId: b.parentId,
        lgdCode: b.lgdCode ?? undefined,
        centroid: { type: "Point", coordinates: [b.centroid.lng, b.centroid.lat] },
        boundary: b.boundary ?? undefined,
        defaultDepartmentId: b.defaultDepartmentId ?? null,
        active: b.active,
      };
      let j;
      if (existing) {
        j = await Jurisdiction.findById(req.params.id);
        if (!j) throw new AppError("NOT_FOUND");
        // Moving a node with children would leave their stored ancestors stale.
        if (
          String(j.parentId ?? "") !== String(b.parentId ?? "") &&
          (await Jurisdiction.exists({ parentId: j._id }))
        )
          throw new AppError("CONFLICT", "jurisdiction_has_children");
        j.set(doc);
        if (!b.boundary) j.boundary = undefined;
        await j.save();
      } else j = await Jurisdiction.create(doc);
      await audit(req, {
        action: existing ? "jurisdiction.updated" : "jurisdiction.created",
        targetType: "jurisdictions",
        targetId: j._id,
      });
      res.status(existing ? 200 : 201).json({ data: { id: String(j._id) } });
    });

  router.post("/", validate({ body: jurisdictionBody }), save(false));
  router.patch("/:id", validate({ ...idParam, body: jurisdictionBody }), save(true));
  return router;
}

// --- audit log (docs/03 A-13) — read-only -----------------------------------------------------

const auditQuery = z.object({
  actorId: objectId.optional(),
  action: z.string().trim().max(60).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
});

function auditRouter() {
  const router = Router();
  router.get(
    "/",
    validate({ query: auditQuery }),
    wrap(async (req, res) => {
      const { actorId, action, from, to, page } = req.validatedQuery;
      const filter = {};
      if (actorId) filter.actorId = actorId;
      if (action) filter.action = { $regex: `^${escapeRegex(action)}` };
      if (from || to) {
        filter.createdAt = {};
        if (from) filter.createdAt.$gte = from;
        if (to) filter.createdAt.$lte = new Date(to.getTime() + 86400_000 - 1);
      }
      const PAGE = 50;
      const [logs, total] = await Promise.all([
        AuditLog.find(filter)
          .sort({ createdAt: -1 })
          .skip((page - 1) * PAGE)
          .limit(PAGE)
          .lean(),
        AuditLog.countDocuments(filter),
      ]);
      const actors = new Map(
        (
          await User.find({ _id: { $in: logs.map((l) => l.actorId) } })
            .select("name")
            .lean()
        ).map((u) => [String(u._id), u.name]),
      );
      res.json({
        data: {
          items: logs.map((l) => ({
            id: String(l._id),
            at: l.createdAt,
            actor: {
              id: String(l.actorId),
              name: actors.get(String(l.actorId)) ?? null,
              role: l.actorRole,
            },
            action: l.action,
            targetType: l.targetType,
            targetId: String(l.targetId),
            changes: l.changes ?? null,
            ipPrefix: l.ipPrefix ?? null,
          })),
          total,
          page,
        },
      });
    }),
  );
  return router;
}

export function adminManageRouters({ bcryptCost }) {
  return {
    users: usersRouter({ bcryptCost }),
    departments: departmentsRouter(),
    jurisdictions: jurisdictionsRouter(),
    audit: auditRouter(),
  };
}
