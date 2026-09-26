import { Scheme } from "../models/Scheme.js";
import { User } from "../models/User.js";
import { schemeBody } from "../modules/schemes/adminSchemas.js";

/**
 * Imports schemes from seed/schemes.json (doc 06 task 4C.1: sheet → import). New slugs are
 * created as drafts; existing drafts are updated only with `force`; published schemes are never
 * touched (they are edited in the portal, A-09).
 */
export async function seedSchemes(data, { force = false, log = () => {} } = {}) {
  const admin = await User.findOne({ role: "admin", status: "active" }).select("_id").lean();
  if (!admin) throw new Error("No admin user yet — run npm run db:seed:admins first");

  const counts = { created: 0, updated: 0, skipped: 0 };
  for (const raw of data.schemes) {
    const parsed = schemeBody.safeParse(raw);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
      throw new Error(`Scheme "${raw.slug}" is invalid: ${issues.join("; ")}`);
    }
    const body = parsed.data;
    const existing = await Scheme.findOne({ slug: body.slug });
    if (!existing) {
      await Scheme.create({ ...body, status: "draft", createdBy: admin._id, updatedBy: admin._id });
      counts.created += 1;
      log(`+ scheme ${body.slug} (draft)`);
    } else if (force && existing.status === "draft") {
      existing.set({ ...body, rules: body.rules ?? null, updatedBy: admin._id });
      await existing.save();
      counts.updated += 1;
      log(`~ scheme ${body.slug}`);
    } else {
      counts.skipped += 1;
      log(`= scheme ${body.slug} (${existing.status}, left as is)`);
    }
  }
  return counts;
}
