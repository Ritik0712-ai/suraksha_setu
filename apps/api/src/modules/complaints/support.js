import C from "../../config/constants.js";
import { distanceM, toPoint } from "../../lib/distance.js";
import { AppError } from "../../lib/errors.js";
import { Complaint } from "../../models/Complaint.js";
import { Jurisdiction } from "../../models/Jurisdiction.js";

// "Me too" (Oct 2026): before filing, a citizen sees open complaints of the same kind close by
// and can add themselves instead of filing a duplicate. Officials see how many people share
// each problem. Only safe fields go out: no description, photo, name or phone of the filer.

export const NEARBY_RADIUS_M = 500;
export const NEARBY_MAX_AGE_DAYS = 60;
const NEARBY_LIMIT = 5;
const OPEN = C.complaintStatus.filter((s) => s !== "RESOLVED" && s !== "REJECTED");

export function createSupportService() {
  /** GET /complaints/nearby — open, same category, ≤ 500 m (or the citizen's village). */
  async function nearby(user, { category, lat, lng }) {
    let center = lat !== undefined ? toPoint({ lat, lng }) : null;
    if (!center) {
      const home = await Jurisdiction.findById(user.jurisdictionId).select("centroid").lean();
      center = home?.centroid ?? null;
    }
    if (!center) return [];
    const since = new Date(Date.now() - NEARBY_MAX_AGE_DAYS * 24 * 3600 * 1000);
    const docs = await Complaint.find({
      category,
      status: { $in: OPEN },
      createdAt: { $gte: since },
      citizenId: { $ne: user._id },
      location: {
        $nearSphere: { $geometry: center, $maxDistance: NEARBY_RADIUS_M },
      },
    })
      .select("complaintNo category status landmark location supporterCount createdAt supporters")
      .limit(NEARBY_LIMIT)
      .lean();
    const here = { lat: center.coordinates[1], lng: center.coordinates[0] };
    const me = String(user._id);
    return docs.map((c) => ({
      id: String(c._id),
      complaintNo: c.complaintNo,
      category: c.category,
      status: c.status,
      landmark: c.landmark ?? null,
      distanceM: Math.round(
        distanceM(here, { lat: c.location.coordinates[1], lng: c.location.coordinates[0] }),
      ),
      supporterCount: c.supporterCount ?? 0,
      supportedByMe: (c.supporters ?? []).some((id) => String(id) === me),
      createdAt: c.createdAt,
    }));
  }

  /** POST / DELETE /complaints/:id/support — add or remove "me too". Idempotent. */
  async function setSupport(user, id, on) {
    const c = await Complaint.findById(id).select("citizenId status").lean();
    if (!c) throw new AppError("NOT_FOUND", "complaint_not_found");
    if (String(c.citizenId) === String(user._id))
      throw new AppError("VALIDATION_ERROR", "own_complaint", [
        { field: "id", issue: "own_complaint" },
      ]);
    if (on && !OPEN.includes(c.status))
      throw new AppError("CONFLICT", "complaint_closed", [{ field: "status", issue: "closed" }]);
    const updated = on
      ? await Complaint.findOneAndUpdate(
          { _id: id, supporters: { $ne: user._id } },
          { $addToSet: { supporters: user._id }, $inc: { supporterCount: 1 } },
          { new: true, projection: { supporterCount: 1 } },
        ).lean()
      : await Complaint.findOneAndUpdate(
          { _id: id, supporters: user._id },
          { $pull: { supporters: user._id }, $inc: { supporterCount: -1 } },
          { new: true, projection: { supporterCount: 1 } },
        ).lean();
    // null: nothing changed (already supported / not supported) — read the current count.
    const count =
      updated?.supporterCount ??
      (await Complaint.findById(id).select("supporterCount").lean()).supporterCount;
    return { id: String(id), supporterCount: count, supportedByMe: on };
  }

  return { nearby, setSupport };
}
