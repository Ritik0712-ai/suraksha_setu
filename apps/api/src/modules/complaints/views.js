import { maskPhone } from "../../lib/phone.js";
import { Department } from "../../models/Department.js";
import { Jurisdiction } from "../../models/Jurisdiction.js";
import { User } from "../../models/User.js";
import { reopenState } from "./reopen.js";

const toLatLng = (p) => (p ? { lat: p.coordinates[1], lng: p.coordinates[0] } : null);

// Shapes returned by the complaint endpoints (citizen S-12/S-13, authority A-02/A-03).

export async function lookups(docs) {
  const deptIds = [...new Set(docs.map((d) => String(d.departmentId)))];
  const jurIds = [...new Set(docs.map((d) => String(d.jurisdictionId)))];
  const [depts, jurs] = await Promise.all([
    Department.find({ _id: { $in: deptIds } })
      .select("name code")
      .lean(),
    Jurisdiction.find({ _id: { $in: jurIds } })
      .select("name")
      .lean(),
  ]);
  const byId = (list) => new Map(list.map((x) => [String(x._id), x]));
  return { depts: byId(depts), jurs: byId(jurs) };
}

export const timelineEvent = (e) => ({
  type: e.type,
  fromStatus: e.fromStatus ?? null,
  toStatus: e.toStatus ?? null,
  text: e.text ?? null,
  visibility: e.visibility,
  actorRole: e.actorRole,
  at: e.at,
});

/** Card on S-12 (and the portal's live "new complaint" row). */
export function listItem(c, { depts, jurs }) {
  return {
    id: String(c._id),
    complaintNo: c.complaintNo,
    category: c.category,
    status: c.status,
    imageUrl: c.imageUrl ?? null,
    landmark: c.landmark ?? null,
    village: jurs.get(String(c.jurisdictionId))?.name ?? null,
    department: depts.get(String(c.departmentId))?.name ?? null,
    supporterCount: c.supporterCount ?? 0,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

/** What the owner sees on S-13: public timeline only (docs/05 §15). */
export function citizenView(c, maps) {
  const dept = maps.depts.get(String(c.departmentId));
  return {
    ...listItem(c, maps),
    categorySource: c.categorySource,
    description: c.description ?? null,
    location: toLatLng(c.location),
    locationAccuracyM: c.locationAccuracyM ?? null,
    onBehalfOf: c.onBehalfOf ? { name: c.onBehalfOf.name } : null,
    department: dept ? { id: String(dept._id), name: dept.name } : null,
    statusChangedAt: c.statusChangedAt,
    resolutionImageUrl: c.resolutionImageUrl ?? null,
    rejection: c.rejection ?? null,
    reopenCount: c.reopenCount,
    resolvedAt: c.resolvedAt ?? null,
    ...reopenState(c),
    timeline: c.timeline.filter((e) => e.visibility === "public").map(timelineEvent),
  };
}

/** In-scope authority/admin: full record, citizen phone masked (docs/05 §8). */
export async function staffView(c, maps) {
  const actorIds = [...new Set(c.timeline.filter((e) => e.actorId).map((e) => String(e.actorId)))];
  const ids = [c.citizenId, c.assigneeId, ...actorIds].filter(Boolean);
  const people = new Map(
    (
      await User.find({ _id: { $in: ids } })
        .select("name phone role")
        .lean()
    ).map((u) => [String(u._id), u]),
  );
  const citizen = c.citizenId ? people.get(String(c.citizenId)) : null;
  const assignee = c.assigneeId ? people.get(String(c.assigneeId)) : null;
  return {
    ...citizenView(c, maps),
    categorySource: c.categorySource,
    aiSuggestion: c.aiSuggestion ?? null,
    jurisdictionId: String(c.jurisdictionId),
    departmentId: String(c.departmentId),
    assignee: assignee ? { id: String(assignee._id), name: assignee.name } : null,
    firstActionAt: c.firstActionAt ?? null,
    onBehalfOf: c.onBehalfOf
      ? { name: c.onBehalfOf.name, maskedPhone: maskPhone(c.onBehalfOf.phone) }
      : null,
    citizen: citizen ? { name: citizen.name, maskedPhone: maskPhone(citizen.phone) } : null,
    // Full timeline with who did what (docs/03 A-03).
    timeline: c.timeline.map((e) => ({
      ...timelineEvent(e),
      actorName: e.actorId ? (people.get(String(e.actorId))?.name ?? null) : null,
      meta: e.meta ?? null,
    })),
  };
}
