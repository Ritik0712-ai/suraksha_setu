import { toCsv } from "../../lib/csv.js";
import { AppError } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { notify } from "../../lib/notify.js";
import { assertInScope, scopeFilter } from "../../lib/scope.js";
import { Complaint, MAX_TIMELINE_EVENTS } from "../../models/Complaint.js";
import { Department } from "../../models/Department.js";
import { User } from "../../models/User.js";
import { complaintEmail } from "./texts.js";
import { listItem, lookups, staffView } from "./views.js";

// Status changes an authority/admin may make (docs/05 §5.6.1). ASSIGNED goes through assign();
// RESOLVED → ASSIGNED is the citizen's reopen.
export const TRANSITIONS = {
  VERIFIED: { from: ["SUBMITTED"] },
  REJECTED: { from: ["SUBMITTED", "VERIFIED"] },
  IN_PROGRESS: { from: ["ASSIGNED"] },
  RESOLVED: { from: ["IN_PROGRESS"] },
  SUBMITTED: { from: ["REJECTED"], adminOnly: true },
};
export const ASSIGNABLE_FROM = ["VERIFIED", "ASSIGNED", "IN_PROGRESS"];
export const EXPORT_MAX = 5000; // docs/03 A-02
const DAY_MS = 24 * 3600 * 1000;

/** The actions the UI may offer for a status (docs/03 A-03 "allowed next actions only"). */
export function allowedActions(status, role) {
  const statuses = Object.entries(TRANSITIONS)
    .filter(([, t]) => t.from.includes(status) && (!t.adminOnly || role === "admin"))
    .map(([to]) => to);
  return { statuses, canAssign: ASSIGNABLE_FROM.includes(status) };
}

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Mongo filter for the A-02 table, always inside the user's scope. */
export function staffFilter(user, f = {}) {
  const filter = { ...scopeFilter(user) };
  if (f.status?.length) filter.status = { $in: f.status };
  if (f.category?.length) filter.category = { $in: f.category };
  if (f.departmentId) {
    // An officer limited to one department can't widen the filter to another.
    if (filter.departmentId && String(filter.departmentId) !== String(f.departmentId))
      filter._id = null;
    else filter.departmentId = f.departmentId;
  }
  if (f.villageId) filter.jurisdictionId = f.villageId;
  if (f.from || f.to) {
    filter.createdAt = {};
    if (f.from) filter.createdAt.$gte = f.from;
    if (f.to) filter.createdAt.$lte = new Date(f.to.getTime() + DAY_MS - 1); // whole day
  }
  if (f.q) filter.complaintNo = { $regex: escapeRegex(f.q.toUpperCase()) };
  return filter;
}

const SORTS = {
  created: (order) => ({ createdAt: order, _id: order }),
  age: (order) => ({ createdAt: -order, _id: -order }),
  updated: (order) => ({ updatedAt: order, _id: order }),
};

const ageDays = (c, now = Date.now()) => Math.floor((now - new Date(c.createdAt)) / DAY_MS);

function tableRow(c, maps) {
  return {
    ...listItem(c, maps),
    categorySource: c.categorySource,
    aiAccepted: c.categorySource === "ai_accepted",
    ageDays: ageDays(c),
    reopenCount: c.reopenCount,
  };
}

/** Authority/admin side of complaints (docs/03 A-02, A-03). */
export function createComplaintManager({ realtime, storage, mailer }) {
  async function load(user, id) {
    const c = await Complaint.findById(id).lean();
    if (!c) throw new AppError("NOT_FOUND", "complaint_not_found");
    assertInScope(user, c);
    return c;
  }

  async function detail(user, id) {
    const c = await load(user, id);
    return {
      ...(await staffView(c, await lookups([c]))),
      actions: allowedActions(c.status, user.role),
    };
  }

  async function list(user, f) {
    const filter = staffFilter(user, f);
    const order = f.order === "asc" ? 1 : -1;
    const [docs, total] = await Promise.all([
      Complaint.find(filter)
        .sort(SORTS[f.sort ?? "created"](order))
        .skip((f.page - 1) * f.limit)
        .limit(f.limit)
        .select("-timeline -aiSuggestion")
        .lean(),
      Complaint.countDocuments(filter),
    ]);
    const maps = await lookups(docs);
    return { items: docs.map((c) => tableRow(c, maps)), total, page: f.page, limit: f.limit };
  }

  async function exportCsv(user, f) {
    const docs = await Complaint.find(staffFilter(user, f))
      .sort({ createdAt: -1 })
      .limit(EXPORT_MAX)
      .select("-timeline -aiSuggestion")
      .lean();
    const maps = await lookups(docs);
    const ist = (d) =>
      d
        ? new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Kolkata",
            dateStyle: "short",
            timeStyle: "short",
            hour12: false,
          }).format(new Date(d))
        : "";
    // No phone numbers or names in exports (docs/05 §8).
    const rows = [
      [
        "complaint_no",
        "created_ist",
        "category",
        "category_source",
        "status",
        "village",
        "landmark",
        "department",
        "age_days",
        "resolved_ist",
        "reopen_count",
        "description",
      ],
      ...docs.map((c) => [
        c.complaintNo,
        ist(c.createdAt),
        c.category,
        c.categorySource,
        c.status,
        maps.jurs.get(String(c.jurisdictionId))?.name?.en ?? "",
        c.landmark ?? "",
        maps.depts.get(String(c.departmentId))?.name?.en ?? "",
        ageDays(c),
        ist(c.resolvedAt),
        c.reopenCount,
        c.description ?? "",
      ]),
    ];
    return { csv: toCsv(rows), count: docs.length };
  }

  // --- writes -------------------------------------------------------------------------------

  const event = (user, type, extra) => ({
    type,
    visibility: "public",
    actorId: user._id,
    actorRole: user.role,
    at: new Date(),
    ...extra,
  });

  /**
   * Optimistic write (docs/05 §5.6.1): applies only if the status is still what we read, and
   * the timeline has room. Otherwise someone else changed it first → 409.
   */
  async function write(c, { set = {}, events = [] }) {
    const updated = await Complaint.findOneAndUpdate(
      {
        _id: c._id,
        status: c.status,
        updatedAt: c.updatedAt,
        [`timeline.${MAX_TIMELINE_EVENTS - events.length}`]: { $exists: false },
      },
      { $set: set, $push: { timeline: { $each: events } } },
      { new: true, runValidators: true },
    ).lean();
    if (!updated) throw new AppError("CONFLICT", "complaint_changed");
    return updated;
  }

  /** Citizen notification + live events + optional email (docs/03 A-03 "Behaviour"). */
  async function announce(
    c,
    { templateKey = "notif.complaintStatus", type = "complaint_status" } = {},
  ) {
    const maps = await lookups([c]);
    realtime.toScope(c, "complaint:updated", listItem(c, maps));
    if (!c.citizenId) return;
    realtime.toUser(c.citizenId, "complaint:updated", { id: String(c._id), status: c.status });
    try {
      await notify(realtime, {
        recipientId: c.citizenId,
        type,
        templateKey,
        params: { complaintNo: c.complaintNo, status: c.status },
        link: `/complaints/${c._id}`,
      });
      const citizen = await User.findById(c.citizenId).select("email language").lean();
      if (citizen?.email && mailer) {
        const mail = complaintEmail({ complaint: c, kind: type, lang: citizen.language });
        await mailer.send(citizen.email, mail.subject, mail.text);
      }
    } catch (err) {
      logger.warn({ err }, "complaint notification failed");
    }
  }

  const firstAction = (c, now) => (c.firstActionAt ? {} : { firstActionAt: now });

  async function changeStatus(user, id, input) {
    const c = await load(user, id);
    const rule = TRANSITIONS[input.status];
    if (!rule || !rule.from.includes(c.status) || (rule.adminOnly && user.role !== "admin"))
      throw new AppError("CONFLICT", "invalid_transition");
    if (input.status === "REJECTED" && !input.rejection)
      throw new AppError("VALIDATION_ERROR", "validation", [
        { field: "rejection", issue: "required" },
      ]);
    if (input.status === "REJECTED" && input.rejection.code === "other" && !input.rejection.text)
      throw new AppError("VALIDATION_ERROR", "validation", [
        { field: "rejection.text", issue: "required" },
      ]);
    if (input.status === "RESOLVED" && !input.publicNote)
      throw new AppError("VALIDATION_ERROR", "validation", [
        { field: "publicNote", issue: "required" },
      ]);
    if (input.status === "SUBMITTED" && !input.publicNote && !input.internalNote)
      throw new AppError("VALIDATION_ERROR", "validation", [
        { field: "internalNote", issue: "required" },
      ]);

    const now = new Date();
    const set = { status: input.status, statusChangedAt: now, ...firstAction(c, now) };
    if (input.status === "RESOLVED") set.resolvedAt = now;
    if (input.status === "REJECTED") set.rejection = input.rejection;
    if (input.status === "SUBMITTED") set.rejection = null;

    const events = [
      event(user, "status_change", {
        fromStatus: c.status,
        toStatus: input.status,
        text:
          input.publicNote ??
          (input.status === "REJECTED" ? (input.rejection.text ?? undefined) : undefined),
        meta: input.status === "REJECTED" ? { rejectionCode: input.rejection.code } : undefined,
      }),
    ];
    if (input.internalNote)
      events.push(
        event(user, "internal_note", { visibility: "internal", text: input.internalNote }),
      );
    const updated = await write(c, { set, events });
    await announce(updated);
    return updated;
  }

  async function assignOptions(user, id) {
    const c = await load(user, id);
    const departments = await Department.find({
      active: true,
      jurisdictionId: { $in: c.jurisdictionAncestors },
    })
      .select("name code handlesCategories")
      .sort({ code: 1 })
      .lean();
    const officers = await User.find({
      role: "authority",
      status: "active",
      "authority.jurisdictionIds": { $in: c.jurisdictionAncestors },
    })
      .select("name authority")
      .lean();
    return {
      departments: departments.map((d) => ({
        id: String(d._id),
        name: d.name,
        code: d.code,
        handlesCategory: d.handlesCategories.includes(c.category),
      })),
      // Officers with no department can take any complaint.
      assignees: officers.map((o) => ({
        id: String(o._id),
        name: o.name,
        departmentId: o.authority?.departmentId ? String(o.authority.departmentId) : null,
      })),
    };
  }

  async function assign(user, id, { departmentId, assigneeId, publicNote }) {
    const c = await load(user, id);
    if (!ASSIGNABLE_FROM.includes(c.status)) throw new AppError("CONFLICT", "invalid_transition");
    const dept = await Department.findOne({
      _id: departmentId,
      active: true,
      jurisdictionId: { $in: c.jurisdictionAncestors },
    }).lean();
    if (!dept)
      throw new AppError("VALIDATION_ERROR", "validation", [
        { field: "departmentId", issue: "invalid" },
      ]);
    if (assigneeId) {
      const ok = await User.exists({
        _id: assigneeId,
        role: "authority",
        status: "active",
        "authority.jurisdictionIds": { $in: c.jurisdictionAncestors },
        "authority.departmentId": { $in: [null, dept._id] },
      });
      if (!ok)
        throw new AppError("VALIDATION_ERROR", "validation", [
          { field: "assigneeId", issue: "invalid" },
        ]);
    }
    const now = new Date();
    const updated = await write(c, {
      set: {
        status: "ASSIGNED",
        statusChangedAt: c.status === "ASSIGNED" ? c.statusChangedAt : now,
        departmentId: dept._id,
        assigneeId: assigneeId ?? null,
        ...firstAction(c, now),
      },
      events: [
        event(user, "assigned", {
          fromStatus: c.status,
          toStatus: "ASSIGNED",
          text: publicNote,
          meta: { departmentId: String(dept._id), assigneeId: assigneeId ?? null },
        }),
      ],
    });
    await announce(updated);
    return updated;
  }

  // Stored as a correction for retraining (docs/02 §7.2, docs/05 categorySource).
  async function recategorise(user, id, { category }) {
    const c = await load(user, id);
    if (c.category === category) return c;
    const updated = await write(c, {
      set: { category, categorySource: "authority_corrected", ...firstAction(c, new Date()) },
      events: [event(user, "category_changed", { meta: { from: c.category, to: category } })],
    });
    await announce(updated);
    return updated;
  }

  async function addNote(user, id, { visibility, text }) {
    const c = await load(user, id);
    const updated = await write(c, {
      events: [
        event(user, visibility === "public" ? "public_note" : "internal_note", {
          visibility,
          text,
        }),
      ],
    });
    if (visibility === "public")
      await announce(updated, { templateKey: "notif.complaintNote", type: "complaint_note" });
    return updated;
  }

  async function resolutionPhoto(user, id, image) {
    const c = await load(user, id);
    if (!["IN_PROGRESS", "RESOLVED"].includes(c.status))
      throw new AppError("CONFLICT", "invalid_transition");
    if (!storage) throw new AppError("INTERNAL", "upload_failed");
    let stored;
    try {
      stored = await storage.upload(image.buffer, { folder: "resolutions", mime: image.mime });
    } catch (err) {
      logger.error({ err }, "resolution photo upload failed");
      throw new AppError("INTERNAL", "upload_failed");
    }
    const previous = c.resolutionImagePublicId;
    const updated = await write(c, {
      set: { resolutionImageUrl: stored.url, resolutionImagePublicId: stored.publicId },
      events: [event(user, "resolution_photo", {})],
    });
    if (previous) storage.destroy(previous).catch(() => {});
    await announce(updated, { templateKey: "notif.complaintNote", type: "complaint_note" });
    return updated;
  }

  async function revealPhone(user, id, target) {
    const c = await load(user, id);
    if (target === "onBehalf") {
      if (!c.onBehalfOf?.phone) throw new AppError("NOT_FOUND");
      return c.onBehalfOf.phone;
    }
    const citizen = c.citizenId ? await User.findById(c.citizenId).select("phone").lean() : null;
    if (!citizen?.phone) throw new AppError("NOT_FOUND");
    return citizen.phone;
  }

  const view = async (user, c) => ({
    ...(await staffView(c, await lookups([c]))),
    actions: allowedActions(c.status, user.role),
  });

  return {
    detail,
    list,
    exportCsv,
    changeStatus,
    assign,
    assignOptions,
    recategorise,
    addNote,
    resolutionPhoto,
    revealPhone,
    view,
  };
}
