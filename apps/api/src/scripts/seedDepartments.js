import { Department } from "../models/Department.js";
import { Jurisdiction } from "../models/Jurisdiction.js";

async function findJurisdiction({ type, name }) {
  const matches = await Jurisdiction.find({ type, "name.en": name }).select("_id").lean();
  if (matches.length !== 1)
    throw new Error(`Expected exactly one ${type} named "${name}", found ${matches.length}`);
  return matches[0]._id;
}

/**
 * Upserts departments by code and sets jurisdiction default departments (docs/05 §11.2).
 * Idempotent: running it again applies edits from the seed file and creates nothing new.
 */
export async function seedDepartments(data, log = () => {}) {
  const byCode = {};
  for (const d of data.departments) {
    const jurisdictionId = await findJurisdiction(d.jurisdiction);
    const existing = await Department.findOne({ code: d.code });
    const fields = {
      name: d.name,
      jurisdictionId,
      handlesCategories: d.handlesCategories,
      contactPhone: d.contactPhone,
      contactEmail: d.contactEmail,
    };
    const doc = existing
      ? Object.assign(existing, fields)
      : new Department({ code: d.code, ...fields });
    await doc.save();
    byCode[d.code] = doc._id;
    log(`${existing ? "=" : "+"} department ${d.code}`);
  }
  for (const def of data.defaults ?? []) {
    const departmentId = byCode[def.department];
    if (!departmentId) throw new Error(`Unknown default department ${def.department}`);
    const jurisdictionId = await findJurisdiction(def.jurisdiction);
    await Jurisdiction.updateOne({ _id: jurisdictionId }, { defaultDepartmentId: departmentId });
    log(`= default for ${def.jurisdiction.type} ${def.jurisdiction.name} → ${def.department}`);
  }
  return byCode;
}
