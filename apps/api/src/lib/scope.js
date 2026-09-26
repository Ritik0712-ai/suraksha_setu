import { AppError } from "./errors.js";

const ids = (list) => (list ?? []).map(String);

/**
 * Resource-level scope check (docs/05 §8). Admins see everything. Authorities see documents whose
 * jurisdictionAncestors include one of their jurisdictions and, for complaints, whose department
 * matches theirs (a null departmentId on the officer means all departments).
 *
 * @param opts.ignoreDepartment  true for SOS: every in-scope officer sees every SOS.
 */
export function assertInScope(user, doc, { ignoreDepartment = false } = {}) {
  if (user.role === "admin") return;
  if (user.role !== "authority") throw new AppError("FORBIDDEN");

  const mine = new Set(ids(user.authority?.jurisdictionIds));
  const inJur = ids(doc.jurisdictionAncestors).some((id) => mine.has(id));
  const officerDept = user.authority?.departmentId ? String(user.authority.departmentId) : null;
  const inDept =
    ignoreDepartment ||
    !officerDept ||
    !doc.departmentId ||
    officerDept === String(doc.departmentId);

  if (!inJur || !inDept) throw new AppError("FORBIDDEN");
}

/**
 * Mongo filter that applies the same scope inside a list query, so out-of-scope documents are
 * never loaded (docs/05 §8: "never by filtering afterwards"). Returns {} for admins.
 */
export function scopeFilter(user, { ignoreDepartment = false } = {}) {
  if (user.role === "admin") return {};
  if (user.role !== "authority") throw new AppError("FORBIDDEN");
  const filter = { jurisdictionAncestors: { $in: user.authority?.jurisdictionIds ?? [] } };
  if (!ignoreDepartment && user.authority?.departmentId)
    filter.departmentId = user.authority.departmentId;
  return filter;
}
