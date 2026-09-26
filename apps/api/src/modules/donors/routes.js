import { Router } from "express";
import { z } from "zod";
import C from "../../config/constants.js";
import { toLatLng, toPoint } from "../../lib/distance.js";
import { AppError } from "../../lib/errors.js";
import { istDayStart } from "../../lib/time.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { BloodDonor, displayNameFrom } from "../../models/BloodDonor.js";
import { DONOR_REVEALS_PER_DAY, DonorContactRequest } from "../../models/DonorContactRequest.js";
import { Jurisdiction } from "../../models/Jurisdiction.js";
import { User } from "../../models/User.js";
import { resolveJurisdiction } from "../../services/jurisdictionResolver.js";
import { objectId } from "../auth/schemas.js";
import { availabilityBody, donorBody, revealBody, searchQuery } from "./schemas.js";

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);
const SEARCH_LIMIT = 50; // docs/05 §5.11

/** "+919876543221" → "98XXXXXX21" (docs/03 S-21). */
export function maskDonorPhone(e164) {
  const d = String(e164 ?? "").replace(/^\+91/, "");
  return d.length === 10 ? `${d.slice(0, 2)}XXXXXX${d.slice(8)}` : null;
}

function monthStart(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

async function ownView(d) {
  const [village, viewsThisMonth] = await Promise.all([
    Jurisdiction.findById(d.jurisdictionId).select("name").lean(),
    DonorContactRequest.countDocuments({ donorId: d._id, createdAt: { $gte: monthStart() } }),
  ]);
  return {
    id: String(d._id),
    bloodGroup: d.bloodGroup,
    lastDonatedAt: d.lastDonatedAt ?? null,
    eligibleFrom: d.eligibleFrom,
    eligibleNow: d.eligibleFrom <= new Date(),
    available: d.available,
    location: toLatLng(d.location),
    village: village?.name ?? null,
    displayName: d.displayName,
    consentAt: d.consentAt,
    viewsThisMonth,
  };
}

async function homeCentroid(userId) {
  const u = await User.findById(userId).select("jurisdictionId").lean();
  const j = await Jurisdiction.findById(u.jurisdictionId).select("centroid").lean();
  return { jurisdictionId: u.jurisdictionId, point: toLatLng(j.centroid) };
}

/** /api/v1/donors (docs/02 §7.2 "Blood donors (M4)"). Citizens only. */
export function donorsRouter({ env }) {
  const router = Router();
  router.use(requireAuth(env), requireRole("citizen"));

  router.get(
    "/me",
    wrap(async (req, res) => {
      const d = await BloodDonor.findOne({ userId: req.user._id }).lean();
      if (!d) throw new AppError("NOT_FOUND", "donor_not_found");
      res.json({ data: await ownView(d) });
    }),
  );

  router.put(
    "/me",
    validate({ body: donorBody }),
    wrap(async (req, res) => {
      const { bloodGroup, lastDonatedAt, location, available } = req.body;
      const user = await User.findById(req.user._id).select("name jurisdictionId").lean();
      let point = location;
      let jurisdictionId;
      if (point) ({ jurisdictionId } = await resolveJurisdiction(point, user.jurisdictionId));
      else ({ point, jurisdictionId } = await homeCentroid(req.user._id));

      let d = await BloodDonor.findOne({ userId: req.user._id });
      if (!d) d = new BloodDonor({ userId: req.user._id, consentAt: new Date() });
      d.set({
        bloodGroup,
        lastDonatedAt,
        available,
        location: toPoint(point),
        jurisdictionId,
        displayName: displayNameFrom(user.name),
      });
      const created = d.isNew;
      await d.save();
      res.status(created ? 201 : 200).json({ data: await ownView(d.toObject()) });
    }),
  );

  router.patch(
    "/me/availability",
    validate({ body: availabilityBody }),
    wrap(async (req, res) => {
      const d = await BloodDonor.findOneAndUpdate(
        { userId: req.user._id },
        { available: req.body.available },
        { new: true },
      ).lean();
      if (!d) throw new AppError("NOT_FOUND", "donor_not_found");
      res.json({ data: await ownView(d) });
    }),
  );

  router.delete(
    "/me",
    wrap(async (req, res) => {
      await BloodDonor.deleteOne({ userId: req.user._id });
      res.json({ data: { removed: true } });
    }),
  );

  // $geoNear with compatibility, availability and the 90-day gap; phones stay masked.
  router.get(
    "/search",
    validate({ query: searchQuery }),
    wrap(async (req, res) => {
      const { bloodGroup, lat, lng, radiusKm, includeCompatible } = req.validatedQuery;
      const from = lat === undefined ? (await homeCentroid(req.user._id)).point : { lat, lng };
      const groups = includeCompatible ? C.bloodCompatibility[bloodGroup] : [bloodGroup];
      const found = await BloodDonor.aggregate([
        {
          $geoNear: {
            near: toPoint(from),
            distanceField: "distanceM",
            maxDistance: radiusKm * 1000,
            spherical: true,
            query: {
              bloodGroup: { $in: groups },
              available: true,
              eligibleFrom: { $lte: new Date() },
              userId: { $ne: req.user._id },
            },
          },
        },
        { $limit: SEARCH_LIMIT },
      ]);
      const [users, villages] = await Promise.all([
        User.find({ _id: { $in: found.map((d) => d.userId) }, status: "active" })
          .select("phone")
          .lean(),
        Jurisdiction.find({ _id: { $in: found.map((d) => d.jurisdictionId) } })
          .select("name")
          .lean(),
      ]);
      const phoneOf = new Map(users.map((u) => [String(u._id), u.phone]));
      const villageOf = new Map(villages.map((v) => [String(v._id), v.name]));
      const donors = found
        .filter((d) => phoneOf.get(String(d.userId)))
        .map((d) => ({
          id: String(d._id),
          bloodGroup: d.bloodGroup,
          displayName: d.displayName,
          village: villageOf.get(String(d.jurisdictionId)) ?? null,
          distanceM: Math.round(d.distanceM),
          lastDonatedAt: d.lastDonatedAt ?? null,
          compatible: d.bloodGroup !== bloodGroup,
          maskedPhone: maskDonorPhone(phoneOf.get(String(d.userId))),
        }));
      res.json({ data: { donors, radiusKm, groups } });
    }),
  );

  // 10 reveals per IST day, each logged (docs/01 FR-BLD-04, docs/05 §5.12).
  router.post(
    "/:donorId/reveal",
    validate({ params: z.object({ donorId: objectId }), body: revealBody }),
    wrap(async (req, res) => {
      const d = await BloodDonor.findOne({
        _id: req.params.donorId,
        available: true,
        userId: { $ne: req.user._id },
      }).lean();
      if (!d) throw new AppError("NOT_FOUND", "donor_not_found");
      const today = await DonorContactRequest.countDocuments({
        requesterId: req.user._id,
        createdAt: { $gte: istDayStart() },
      });
      // Seeing the same donor again today doesn't use up another reveal.
      const again = await DonorContactRequest.exists({
        requesterId: req.user._id,
        donorId: d._id,
        createdAt: { $gte: istDayStart() },
      });
      if (!again && today >= DONOR_REVEALS_PER_DAY)
        throw new AppError("RATE_LIMITED", "donor_reveal_limit");
      const donorUser = await User.findOne({ _id: d.userId, status: "active" })
        .select("phone")
        .lean();
      if (!donorUser?.phone) throw new AppError("NOT_FOUND", "donor_not_found");
      if (!again)
        await DonorContactRequest.create({
          requesterId: req.user._id,
          donorId: d._id,
          bloodGroupSearched: req.body.bloodGroupSearched,
        });
      res.json({
        data: {
          phone: donorUser.phone,
          revealsLeftToday: Math.max(0, DONOR_REVEALS_PER_DAY - today - (again ? 0 : 1)),
        },
      });
    }),
  );

  return router;
}
