import { Department } from "../models/Department.js";
import { Jurisdiction } from "../models/Jurisdiction.js";

/**
 * Picks the department for a complaint (docs/05 §5.5, docs/02 §8.3):
 *   1. the active department handling `category` at the nearest level of `jurisdictionAncestors`
 *      (village first, then GP, block, district, state),
 *   2. otherwise the nearest level's active defaultDepartmentId (village's, then GP's, ...).
 *
 * @param {string} category  one of constants.complaintCategories
 * @param {Array} jurisdictionAncestors  [self, parent, ..., root]
 * @returns {{ departmentId, matchedBy: "category"|"default" } | null}
 */
export async function routeDepartment(category, jurisdictionAncestors) {
  const levels = jurisdictionAncestors.map(String);
  const rank = (id) => levels.indexOf(String(id));

  const candidates = await Department.find({
    active: true,
    jurisdictionId: { $in: jurisdictionAncestors },
    handlesCategories: category,
  })
    .select("_id jurisdictionId code")
    .lean();
  if (candidates.length) {
    // Nearest level wins; ties (two departments at one level) break by code for stability.
    candidates.sort(
      (a, b) => rank(a.jurisdictionId) - rank(b.jurisdictionId) || a.code.localeCompare(b.code),
    );
    return { departmentId: candidates[0]._id, matchedBy: "category" };
  }

  const withDefaults = await Jurisdiction.find({
    _id: { $in: jurisdictionAncestors },
    defaultDepartmentId: { $ne: null },
  })
    .select("_id defaultDepartmentId")
    .lean();
  withDefaults.sort((a, b) => rank(a._id) - rank(b._id));

  for (const j of withDefaults) {
    if (await Department.exists({ _id: j.defaultDepartmentId, active: true }))
      return { departmentId: j.defaultDepartmentId, matchedBy: "default" };
  }
  return null;
}
