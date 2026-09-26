import { Jurisdiction } from "../models/Jurisdiction.js";

export const NEAREST_VILLAGE_MAX_M = 5000;

/**
 * Which jurisdiction a point is in (docs/05 §5.4):
 *   1. a village whose boundary contains the point,
 *   2. otherwise the nearest village centroid within 5 km,
 *   3. otherwise the user's home jurisdiction.
 *
 * @param {{ lng: number, lat: number } | null} point  null when there is no location at all
 * @param {import("mongoose").Types.ObjectId | string} homeJurisdictionId
 * @returns {{ jurisdictionId, jurisdictionAncestors, matchedBy: "boundary"|"nearest"|"home" }}
 *          jurisdictionAncestors is [self, parent, ..., root] — the order stored on
 *          complaints and SOS alerts and used for authority scoping.
 */
export async function resolveJurisdiction(point, homeJurisdictionId) {
  let match = null;
  let matchedBy = "home";

  if (point) {
    const geometry = { type: "Point", coordinates: [point.lng, point.lat] };
    match = await Jurisdiction.findOne({
      type: "village",
      active: true,
      boundary: { $geoIntersects: { $geometry: geometry } },
    });
    if (match) matchedBy = "boundary";
    else {
      match = await Jurisdiction.findOne({
        type: "village",
        active: true,
        centroid: { $near: { $geometry: geometry, $maxDistance: NEAREST_VILLAGE_MAX_M } },
      });
      if (match) matchedBy = "nearest";
    }
  }

  if (!match) match = await Jurisdiction.findById(homeJurisdictionId);
  if (!match) throw new Error("home_jurisdiction_not_found");

  return {
    jurisdictionId: match._id,
    jurisdictionAncestors: match.selfAndAncestors(),
    matchedBy,
  };
}
