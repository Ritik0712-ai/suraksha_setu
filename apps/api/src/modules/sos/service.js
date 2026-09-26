import mongoose from "mongoose";
import C from "../../config/constants.js";
import { AppError } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { notify } from "../../lib/notify.js";
import { maskPhone } from "../../lib/phone.js";
import { hashSecret, trackTokenFor } from "../../lib/tokens.js";
import { Jurisdiction } from "../../models/Jurisdiction.js";
import { MAX_LOCATION_HISTORY, SosAlert } from "../../models/SosAlert.js";
import { User } from "../../models/User.js";
import { resolveJurisdiction } from "../../services/jurisdictionResolver.js";
import { safeEmail, sosEmail, sosSmsBody } from "./texts.js";

export const TRACK_TTL_MS = 24 * 3600 * 1000; // docs/01 FR-SOS-06
export const FALSE_ALARM_MS = 60 * 1000; // docs/01 US-05 AC2
export const AUTO_CLOSE_AFTER_MS = 6 * 3600 * 1000; // docs/01 FR-SOS-11
export const FLAG_AFTER_PER_HOUR = 3; // docs/01 §10.3: never blocked, only flagged
const APPROXIMATE_OVER_M = 100; // docs/03 S-06 step 1

const OPEN = C.sosOpenStatus;
const toLatLng = (p) => (p ? { lat: p.coordinates[1], lng: p.coordinates[0] } : null);
const toPoint = ({ lat, lng }) => ({ type: "Point", coordinates: [lng, lat] });
const firstName = (name) =>
  String(name ?? "")
    .trim()
    .split(/\s+/)[0] || "";

export const isApproximate = (sos) =>
  sos.locationSource !== "gps" || (sos.lastAccuracyM ?? 0) > APPROXIMATE_OVER_M;

/** SOS business logic (docs/05 §5.10). `realtime` pushes events; `mailer` sends emails. */
export function createSosService({ env, mailer, realtime }) {
  const pepper = env.REFRESH_TOKEN_PEPPER;
  const trackUrl = (sos) => `${env.PUBLIC_APP_URL}/track/${trackTokenFor(sos._id, pepper)}`;

  // --- shapes -------------------------------------------------------------------------------

  /** What the owner sees on S-07 (includes their SMS text and tracking link). */
  async function ownerView(sos, user) {
    const officer = sos.acknowledgedBy
      ? await User.findById(sos.acknowledgedBy).select("name").lean()
      : null;
    const point = toLatLng(sos.lastLocation);
    const approximate = isApproximate(sos);
    const url = trackUrl(sos);
    return {
      id: String(sos._id),
      status: sos.status,
      triggeredAt: sos.triggeredAt,
      lastUpdateAt: sos.lastUpdateAt,
      locationSource: sos.locationSource,
      approximate,
      lastLocation: point,
      lastAccuracyM: sos.lastAccuracyM ?? null,
      trackUrl: url,
      smsRecipients: sos.contactsSnapshot.map((c) => c.phone),
      smsBody: sosSmsBody({
        name: user.name,
        trackUrl: url,
        point,
        approximate,
        lang: user.language,
      }),
      // `emailed`: this contact got the SOS email, so they'll also get the "safe" email; the
      // others only heard by SMS from the user's phone (S-08 offers them an SMS back).
      contacts: sos.contactsSnapshot.map((c) => ({
        name: c.name,
        relation: c.relation,
        phone: c.phone,
        emailed: Boolean(c.email && sos.emailedTo.includes(c.email)),
      })),
      emailTargets: sos.contactsSnapshot.filter((c) => c.email).length,
      emailedCount: sos.emailedTo.length,
      acknowledgedBy: officer ? { name: officer.name } : null,
      acknowledgedAt: sos.acknowledgedAt ?? null,
      resolvedAt: sos.resolvedAt ?? null,
      closeOutcome: sos.closeOutcome ?? null,
    };
  }

  /** What in-scope authorities see (list + live map). Phones stay masked (docs/05 §8). */
  async function authorityView(sos, { detail = false } = {}) {
    const user = await User.findById(sos.userId).select("name phone").lean();
    const village = await Jurisdiction.findById(sos.jurisdictionId).select("name").lean();
    const view = {
      id: String(sos._id),
      status: sos.status,
      user: { name: user?.name ?? "", maskedPhone: maskPhone(user?.phone) },
      village: village?.name ?? null,
      jurisdictionId: String(sos.jurisdictionId),
      triggeredAt: sos.triggeredAt,
      lastUpdateAt: sos.lastUpdateAt,
      lastLocation: toLatLng(sos.lastLocation),
      lastAccuracyM: sos.lastAccuracyM ?? null,
      locationSource: sos.locationSource,
      approximate: isApproximate(sos),
      flaggedForReview: sos.flaggedForReview,
      acknowledgedAt: sos.acknowledgedAt ?? null,
      resolvedAt: sos.resolvedAt ?? null,
      closeOutcome: sos.closeOutcome ?? null,
    };
    if (!detail) return view;
    const [ackBy, closedBy] = await Promise.all([
      sos.acknowledgedBy ? User.findById(sos.acknowledgedBy).select("name").lean() : null,
      sos.closedBy ? User.findById(sos.closedBy).select("name").lean() : null,
    ]);
    return {
      ...view,
      trail: sos.locationHistory.map((p) => ({
        ...toLatLng(p.point),
        accuracyM: p.accuracyM ?? null,
        at: p.at,
      })),
      // Names and relations only; phones are revealed one at a time, audited (docs/03 A-05).
      contacts: sos.contactsSnapshot.map((c, index) => ({
        index,
        name: c.name,
        relation: c.relation,
      })),
      acknowledgedBy: ackBy ? { name: ackBy.name } : null,
      closedBy: closedBy ? { name: closedBy.name } : null,
      closeNote: sos.closeNote ?? null,
      createdVia: sos.createdVia,
    };
  }

  const liveEvent = (sos) => ({
    id: String(sos._id),
    status: sos.status,
    lastLocation: toLatLng(sos.lastLocation),
    lastAccuracyM: sos.lastAccuracyM ?? null,
    lastUpdateAt: sos.lastUpdateAt,
  });

  // --- trigger (docs/03 S-06, docs/02 §8.1) --------------------------------------------------

  async function emailContacts(sos, user) {
    const point = toLatLng(sos.lastLocation);
    const url = trackUrl(sos);
    const approximate = isApproximate(sos);
    const sent = [];
    for (const c of sos.contactsSnapshot.filter((x) => x.email)) {
      const mail = sosEmail({
        name: user.name,
        trackUrl: url,
        point,
        approximate,
        lang: user.language,
        at: sos.triggeredAt,
      });
      if (await mailer.send(c.email, mail.subject, mail.text)) sent.push(c.email);
    }
    if (sent.length)
      await SosAlert.updateOne({ _id: sos._id }, { $addToSet: { emailedTo: { $each: sent } } });
  }

  /**
   * Creates the SOS, or returns the user's open one (only one per user, docs/05 §5.10).
   * Never rate-limited; more than 3 in an hour is flagged for review, still sent.
   */
  async function trigger(userId, input) {
    const user = await User.findById(userId).lean();
    const existing = await SosAlert.findOne({ userId, status: { $in: OPEN } });
    if (existing) return { view: await ownerView(existing, user), existing: true };

    const now = new Date();
    const triggeredAt =
      input.triggeredAt && input.triggeredAt <= now && now - input.triggeredAt < 2 * 3600 * 1000
        ? input.triggeredAt
        : now;
    const hasPoint = input.lat !== undefined && input.lng !== undefined;
    const { jurisdictionId, jurisdictionAncestors } = await resolveJurisdiction(
      hasPoint ? { lat: input.lat, lng: input.lng } : null,
      user.jurisdictionId,
    );

    // No coordinates ("village" fallback): use the home village's centroid.
    let point = hasPoint ? toPoint(input) : null;
    if (!point) {
      const home = await Jurisdiction.findById(user.jurisdictionId).select("centroid").lean();
      point = home.centroid;
    }

    const recent = await SosAlert.countDocuments({
      userId,
      triggeredAt: { $gte: new Date(now.getTime() - 3600 * 1000) },
    });

    // The id is chosen up front so the tracking-token hash goes in with the first insert.
    const _id = new mongoose.Types.ObjectId();
    let sos;
    try {
      sos = await SosAlert.create({
        _id,
        userId,
        status: "ACTIVE",
        startLocation: point,
        lastLocation: point,
        lastAccuracyM: hasPoint ? input.accuracyM : undefined,
        locationSource: hasPoint ? input.source : "village",
        locationHistory: [
          { point, accuracyM: hasPoint ? input.accuracyM : undefined, at: triggeredAt },
        ],
        jurisdictionId,
        jurisdictionAncestors,
        contactsSnapshot: (user.emergencyContacts ?? []).map((c) => ({
          name: c.name,
          relation: c.relation,
          phone: c.phone,
          email: c.email ?? null,
        })),
        trackTokenHash: hashSecret(trackTokenFor(_id, pepper), pepper),
        trackTokenExpiresAt: new Date(triggeredAt.getTime() + TRACK_TTL_MS),
        triggeredAt,
        lastUpdateAt: now,
        flaggedForReview: recent >= FLAG_AFTER_PER_HOUR,
        createdVia: input.createdVia ?? "online",
      });
    } catch (err) {
      // Two taps racing past the check above: the unique partial index keeps one open SOS.
      if (err?.code === 11000) {
        const open = await SosAlert.findOne({ userId, status: { $in: OPEN } });
        if (open) return { view: await ownerView(open, user), existing: true };
      }
      throw err;
    }

    realtime.toScope(sos, "sos:new", await authorityView(sos));
    // Emails go out after the response; the SMS path on the phone doesn't wait for us.
    emailContacts(sos, user).catch((err) => logger.error({ err }, "SOS email failed"));
    return { view: await ownerView(sos, user), existing: false };
  }

  // --- owner actions --------------------------------------------------------------------------

  async function getOwned(userId, id) {
    const sos = await SosAlert.findOne({ _id: id, userId });
    if (!sos) throw new AppError("NOT_FOUND");
    return sos;
  }

  async function ownerDetail(userId, id) {
    const [sos, user] = await Promise.all([getOwned(userId, id), User.findById(userId).lean()]);
    return ownerView(sos, user);
  }

  async function mine(userId, { open } = {}) {
    const filter = { userId, ...(open ? { status: { $in: OPEN } } : {}) };
    const list = await SosAlert.find(filter).sort({ triggeredAt: -1 }).limit(50).lean();
    return list.map((s) => ({
      id: String(s._id),
      status: s.status,
      triggeredAt: s.triggeredAt,
      resolvedAt: s.resolvedAt ?? null,
      durationSec: s.resolvedAt ? Math.round((s.resolvedAt - s.triggeredAt) / 1000) : null,
    }));
  }

  /** Every 30 s from S-07 (docs/01 FR-SOS-05). Points are capped at 720 per SOS. */
  async function pushLocation(userId, id, { lat, lng, accuracyM, at }) {
    const now = new Date();
    const when = at && at <= now ? at : now;
    const point = toPoint({ lat, lng });
    const sos = await SosAlert.findOneAndUpdate(
      { _id: id, userId, status: { $in: OPEN } },
      {
        $set: {
          lastLocation: point,
          lastAccuracyM: accuracyM,
          lastUpdateAt: now,
          locationSource: "gps",
        },
        $push: {
          locationHistory: {
            $each: [{ point, accuracyM, at: when }],
            $slice: -MAX_LOCATION_HISTORY,
          },
        },
      },
      { new: true },
    );
    if (!sos) {
      if (await SosAlert.exists({ _id: id, userId })) throw new AppError("CONFLICT");
      throw new AppError("NOT_FOUND");
    }
    realtime.toScope(sos, "sos:location", liveEvent(sos));
    return { ok: true };
  }

  /** "I am safe": RESOLVED_SAFE, or FALSE_ALARM within 60 s of triggering (docs/01 US-05). */
  async function resolve(userId, id) {
    const now = new Date();
    const current = await getOwned(userId, id);
    if (!OPEN.includes(current.status)) return ownerDetail(userId, id);
    const status = now - current.triggeredAt < FALSE_ALARM_MS ? "FALSE_ALARM" : "RESOLVED_SAFE";
    const sos = await SosAlert.findOneAndUpdate(
      { _id: id, userId, status: { $in: OPEN } },
      { $set: { status, resolvedAt: now, lastUpdateAt: now, trackTokenExpiresAt: now } },
      { new: true },
    );
    if (!sos) return ownerDetail(userId, id);

    const user = await User.findById(userId).lean();
    realtime.toScope(sos, "sos:updated", liveEvent(sos));
    const mail = safeEmail({ name: user.name, lang: user.language });
    for (const email of sos.emailedTo) mailer.send(email, mail.subject, mail.text).catch(() => {});
    return ownerView(sos, user);
  }

  // --- authority actions -------------------------------------------------------------------

  async function acknowledge(officer, sos) {
    const now = new Date();
    const updated = await SosAlert.findOneAndUpdate(
      { _id: sos._id, status: "ACTIVE" },
      {
        $set: {
          status: "ACKNOWLEDGED",
          acknowledgedBy: officer._id,
          acknowledgedAt: now,
          lastUpdateAt: now,
        },
      },
      { new: true },
    );
    if (!updated) throw new AppError("CONFLICT");
    const officerUser = await User.findById(officer._id).select("name").lean();
    realtime.toScope(updated, "sos:updated", liveEvent(updated));
    realtime.toUser(updated.userId, "sos:acknowledged", {
      id: String(updated._id),
      officerName: officerUser?.name ?? "",
      at: now,
    });
    await notify(realtime, {
      recipientId: updated.userId,
      type: "sos_acknowledged",
      templateKey: "notif.sosAcknowledged",
      params: { officerName: officerUser?.name ?? "" },
      link: `/sos/${updated._id}`,
    });
    return updated;
  }

  async function close(officer, sos, { outcome, note }) {
    const now = new Date();
    const updated = await SosAlert.findOneAndUpdate(
      { _id: sos._id, status: { $in: OPEN } },
      {
        $set: {
          status: "RESOLVED_BY_AUTHORITY",
          closedBy: officer._id,
          closeOutcome: outcome,
          closeNote: note,
          resolvedAt: now,
          lastUpdateAt: now,
          trackTokenExpiresAt: now,
        },
      },
      { new: true },
    );
    if (!updated) throw new AppError("CONFLICT");
    realtime.toScope(updated, "sos:updated", liveEvent(updated));
    realtime.toUser(updated.userId, "sos:updated", liveEvent(updated));
    await notify(realtime, {
      recipientId: updated.userId,
      type: "sos_closed",
      templateKey: "notif.sosClosed",
      params: {},
      link: `/sos/${updated._id}`,
    });
    return updated;
  }

  /** Public live view for contacts (S-30): first name, location, status — nothing else. */
  async function track(token) {
    const sos = await SosAlert.findOne({ trackTokenHash: hashSecret(token, pepper) }).lean();
    if (!sos) throw new AppError("NOT_FOUND");
    const now = new Date();
    const user = await User.findById(sos.userId).select("name").lean();
    const base = { firstName: firstName(user?.name), status: sos.status };
    const open = OPEN.includes(sos.status);

    if (open && sos.trackTokenExpiresAt > now) {
      const trail = sos.locationHistory.slice(-10).map((p) => ({ ...toLatLng(p.point), at: p.at }));
      return {
        ...base,
        lastLocation: toLatLng(sos.lastLocation),
        lastAccuracyM: sos.lastAccuracyM ?? null,
        approximate: isApproximate(sos),
        updatedAt: sos.lastUpdateAt,
        trail,
      };
    }
    // After it ends, contacts may still open the link for the rest of the 24 h to see that
    // she is safe — but the location is never shown again (docs/05 §5.10, §10).
    if (!open && now - sos.triggeredAt < TRACK_TTL_MS)
      return { ...base, resolvedAt: sos.resolvedAt };
    throw new AppError("NOT_FOUND");
  }

  return {
    trigger,
    ownerDetail,
    mine,
    pushLocation,
    resolve,
    acknowledge,
    close,
    track,
    authorityView,
  };
}
