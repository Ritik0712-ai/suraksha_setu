import { parseCsvObjects } from "../lib/csv.js";
import { toPoint } from "../lib/distance.js";
import { EmergencyService } from "../models/EmergencyService.js";
import { User } from "../models/User.js";
import { rowToBody } from "../modules/emergency/admin.js";
import { serviceBody } from "../modules/emergency/schemas.js";
import { resolveJurisdiction } from "../services/jurisdictionResolver.js";

/**
 * Upserts curated services from CSV text, matched by English name + type. Rows are validated
 * like the portal import; an invalid row stops the import before anything is written.
 */
export async function seedEmergencyServices(csv, { log = () => {} } = {}) {
  const admin = await User.findOne({ role: "admin", status: "active" })
    .select("_id jurisdictionId")
    .lean();
  if (!admin) throw new Error("No admin user yet — run npm run db:seed:admins first");
  const bodies = parseCsvObjects(csv).map((r, i) => {
    const parsed = serviceBody.safeParse(rowToBody(r));
    if (!parsed.success)
      throw new Error(
        `row ${i + 2}: ${parsed.error.issues.map((x) => `${x.path.join(".")} ${x.message}`).join("; ")}`,
      );
    return parsed.data;
  });
  const counts = { created: 0, updated: 0 };
  for (const b of bodies) {
    const point = { lat: b.lat, lng: b.lng };
    const { jurisdictionId } = await resolveJurisdiction(point, admin.jurisdictionId);
    const doc = {
      name: b.name,
      type: b.type,
      address: b.address,
      phones: b.phones,
      location: toPoint(point),
      jurisdictionId,
      is24x7: b.is24x7,
      notes: b.notes ?? undefined,
      verifiedAt: b.verifiedOn,
      verifiedBy: admin._id,
      active: true,
    };
    const res = await EmergencyService.updateOne(
      { "name.en": b.name.en, type: b.type },
      { $set: doc },
      { upsert: true, runValidators: true },
    );
    if (res.upsertedCount) counts.created += 1;
    else counts.updated += 1;
    log(`${res.upsertedCount ? "+" : "~"} ${b.type} ${b.name.en}`);
  }
  return counts;
}
