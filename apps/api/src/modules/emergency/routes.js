import { Router } from "express";
import C from "../../config/constants.js";
import { distanceM, toLatLng, toPoint } from "../../lib/distance.js";
import { requestLanguage } from "../../lib/messages.js";
import { AppError } from "../../lib/errors.js";
import { optionalAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { Jurisdiction } from "../../models/Jurisdiction.js";
import { User } from "../../models/User.js";
import { EmergencyService } from "../../models/EmergencyService.js";
import { placesNearby } from "./places.js";
import { nearbyQuery } from "./schemas.js";

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);
export const MIN_CURATED = 3; // docs/02 §7.2: Places only when fewer than 3 curated results
const DEDUPE_M = 150;

// The S-20 "Hospital" tab also shows PHCs/CHCs.
const CURATED_TYPES = { hospital: ["hospital", "phc_chc"] };

export const curatedView = (s, from) => ({
  id: String(s._id),
  source: "curated",
  type: s.type,
  name: s.name,
  address: s.address,
  phones: s.phones,
  ...toLatLng(s.location),
  distanceM: s.distanceM ?? (from ? distanceM(from, toLatLng(s.location)) : null),
  is24x7: s.is24x7 ?? null,
  notes: s.notes ?? null,
  verifiedAt: s.verifiedAt,
});

/** /api/v1/emergency (docs/02 §7.2 "Emergency services (M5)"). Public. */
export function emergencyRouter({ env, fetchImpl, limiter }) {
  const router = Router();

  router.get("/helplines", (_req, res) => {
    res.set("Cache-Control", "public, max-age=86400");
    res.json({ data: C.helplines });
  });

  router.get(
    "/nearby",
    limiter,
    optionalAuth(env),
    validate({ query: nearbyQuery }),
    wrap(async (req, res) => {
      const { type, radiusKm } = req.validatedQuery;
      let from;
      let approximate = false;
      if (req.validatedQuery.lat !== undefined)
        from = { lat: req.validatedQuery.lat, lng: req.validatedQuery.lng };
      else {
        // Location denied: use the signed-in user's home village (docs/03 S-20).
        const u = req.user
          ? await User.findById(req.user._id).select("jurisdictionId").lean()
          : null;
        const home = u
          ? await Jurisdiction.findById(u.jurisdictionId).select("centroid").lean()
          : null;
        if (!home)
          throw new AppError("VALIDATION_ERROR", "validation", [
            { field: "lat", issue: "required" },
          ]);
        from = toLatLng(home.centroid);
        approximate = true;
      }
      const { lat, lng } = from;
      const curated = await EmergencyService.aggregate([
        {
          $geoNear: {
            near: toPoint(from),
            distanceField: "distanceM",
            maxDistance: radiusKm * 1000,
            spherical: true,
            query: { type: { $in: CURATED_TYPES[type] ?? [type] }, active: true },
          },
        },
        { $limit: 20 },
      ]);
      const services = curated.map((s) => ({
        ...curatedView(s),
        distanceM: Math.round(s.distanceM),
      }));

      let placesUsed = false;
      if (services.length < MIN_CURATED && env.GOOGLE_PLACES_KEY) {
        const found = await placesNearby({
          key: env.GOOGLE_PLACES_KEY,
          fetchImpl,
          type,
          lat,
          lng,
          radiusM: radiusKm * 1000,
          lang: requestLanguage(req),
        });
        placesUsed = found.length > 0;
        for (const p of found) {
          const near = services.some((s) => distanceM(s, p) < DEDUPE_M);
          if (near) continue;
          services.push({
            id: `place:${p.placeId}`,
            source: "google",
            type,
            name: { hi: p.name, en: p.name },
            address: { hi: p.address, en: p.address },
            phones: p.phone ? [p.phone] : [],
            lat: p.lat,
            lng: p.lng,
            distanceM: distanceM(from, p),
            is24x7: null,
            notes: null,
            verifiedAt: null,
          });
        }
        services.sort((a, b) => a.distanceM - b.distanceM);
      }
      res.set("Cache-Control", "no-store");
      res.json({ data: { services, placesUsed, from, approximate } });
    }),
  );

  return router;
}
