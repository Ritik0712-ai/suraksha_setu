import C from "../../config/constants.js";
import { AppError } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { notify } from "../../lib/notify.js";
import { assertInScope } from "../../lib/scope.js";
import { istDayStart } from "../../lib/time.js";
import { withTransaction } from "../../lib/transaction.js";

export { istDayStart };
import { MAX_REOPENS, MAX_TIMELINE_EVENTS, Complaint } from "../../models/Complaint.js";
import { nextComplaintNo } from "../../models/Counter.js";
import { Department } from "../../models/Department.js";
import { Jurisdiction } from "../../models/Jurisdiction.js";
import { Upload } from "../../models/Upload.js";
import { UsageEvent } from "../../models/UsageEvent.js";
import { STALE_UPLOAD_MS } from "../../jobs/uploadJobs.js";
import { citizenView, listItem, lookups, staffView } from "./views.js";
import { REOPEN_WINDOW_MS, reopenState } from "./reopen.js";

export { REOPEN_WINDOW_MS, reopenState };
import { routeDepartment } from "../../services/departmentRouting.js";
import { resolveJurisdiction } from "../../services/jurisdictionResolver.js";

export const DAILY_COMPLAINT_LIMIT = 10; // docs/02 SEC-06
export const DAILY_UPLOAD_LIMIT = 30; // retakes included; stops Cloudinary abuse
export const AI_ACCEPT_MIN_CONFIDENCE = 0.6; // docs/03 S-10 step 2
export const PAGE_SIZE = 20; // docs/03 S-12

const OPEN_STATUSES = C.complaintStatus.filter((s) => s !== "RESOLVED" && s !== "REJECTED");
const STATUS_FILTER = {
  open: { $in: OPEN_STATUSES },
  resolved: "RESOLVED",
  rejected: "REJECTED",
};

const toPoint = ({ lat, lng }) => ({ type: "Point", coordinates: [lng, lat] });

/** Civic complaints (docs/05 §5.6). `storage` holds photos, `ai` is the classifier client. */
export function createComplaintService({ realtime, storage, ai }) {
  // --- photo + AI (docs/02 §8.2) --------------------------------------------------------------

  async function classify(userId, { buffer, mime }) {
    if (!storage) throw new AppError("INTERNAL", "upload_failed");
    const today = await Upload.countDocuments({
      userId,
      createdAt: { $gte: istDayStart() },
    });
    if (today >= DAILY_UPLOAD_LIMIT) throw new AppError("RATE_LIMITED", "upload_daily_limit");

    let stored;
    try {
      stored = await storage.upload(buffer, { folder: "complaints", mime });
    } catch (err) {
      logger.error({ err }, "photo upload failed");
      throw new AppError("INTERNAL", "upload_failed");
    }
    // Recorded before the AI call, so the hourly cleanup finds it even if nothing follows.
    const upload = await Upload.create({
      userId,
      purpose: "complaint",
      imageUrl: stored.url,
      publicId: stored.publicId,
      bytes: stored.bytes,
      width: stored.width,
      height: stored.height,
    });

    const suggestion = await ai.classify(stored.url);
    if (suggestion) await Upload.updateOne({ _id: upload._id }, { aiSuggestion: suggestion });
    return {
      uploadId: String(upload._id),
      imageUrl: stored.url,
      suggestion: suggestion && {
        category: suggestion.category,
        confidence: suggestion.confidence,
        top3: suggestion.top3,
        modelVersion: suggestion.modelVersion,
      },
    };
  }

  // --- create (docs/05 §5.6.1 "(new) → SUBMITTED") ---------------------------------------------

  async function locate(user, location) {
    const resolved = await resolveJurisdiction(location ?? null, user.jurisdictionId);
    let point = location ? toPoint(location) : null;
    if (!point) {
      const home = await Jurisdiction.findById(user.jurisdictionId).select("centroid").lean();
      point = home.centroid;
    }
    return { ...resolved, point };
  }

  async function create(user, input) {
    const today = await Complaint.countDocuments({
      citizenId: user._id,
      createdAt: { $gte: istDayStart() },
    });
    if (today >= DAILY_COMPLAINT_LIMIT) throw new AppError("RATE_LIMITED", "complaint_daily_limit");

    let upload = null;
    if (input.uploadId) {
      upload = await Upload.findOne({
        _id: input.uploadId,
        userId: user._id,
        purpose: "complaint",
        status: "pending",
        // An hour's margin before the cleanup job may delete the file (jobs/uploadJobs.js).
        createdAt: { $gt: new Date(Date.now() - STALE_UPLOAD_MS + 3600 * 1000) },
      }).lean();
      if (!upload)
        throw new AppError("VALIDATION_ERROR", "upload_invalid", [
          { field: "uploadId", issue: "invalid" },
        ]);
    }

    const { jurisdictionId, jurisdictionAncestors, point } = await locate(user, input.location);
    const route = await routeDepartment(input.category, jurisdictionAncestors);
    if (!route) {
      logger.error({ jurisdictionId, category: input.category }, "no department for complaint");
      throw new AppError("CONFLICT", "no_department");
    }

    const ai = upload?.aiSuggestion ?? null;
    const accepted =
      ai && ai.category === input.category && ai.confidence >= AI_ACCEPT_MIN_CONFIDENCE;
    const now = new Date();

    const created = await withTransaction(async (session) => {
      const complaintNo = await nextComplaintNo({ date: now, session });
      const [doc] = await Complaint.create(
        [
          {
            complaintNo,
            citizenId: user._id,
            onBehalfOf: input.onBehalfOf
              ? { name: input.onBehalfOf.name, phone: input.onBehalfOf.phone }
              : null,
            category: input.category,
            categorySource: accepted ? "ai_accepted" : "user_selected",
            aiSuggestion: ai,
            description: input.description,
            landmark: input.landmark,
            location: point,
            locationAccuracyM: input.location?.accuracyM,
            jurisdictionId,
            jurisdictionAncestors,
            departmentId: route.departmentId,
            status: "SUBMITTED",
            statusChangedAt: now,
            imageUrl: upload?.imageUrl,
            imagePublicId: upload?.publicId,
            timeline: [
              {
                type: "created",
                toStatus: "SUBMITTED",
                visibility: "public",
                actorId: user._id,
                actorRole: "citizen",
                at: now,
              },
            ],
          },
        ],
        { session },
      );
      if (upload) {
        const res = await Upload.updateOne(
          { _id: upload._id, status: "pending" },
          { status: "attached", attachedTo: doc._id },
          { session },
        );
        // Two submits racing with one photo: the second one loses (and rolls back).
        if (res.matchedCount !== 1)
          throw new AppError("VALIDATION_ERROR", "upload_invalid", [
            { field: "uploadId", issue: "invalid" },
          ]);
      }
      return doc;
    });

    const complaint = created.toObject();
    const maps = await lookups([complaint]);
    // Side effects after commit; a failure here must not fail the citizen's submission.
    try {
      await notify(realtime, {
        recipientId: user._id,
        type: "complaint_submitted",
        templateKey: "notif.complaintSubmitted",
        params: { complaintNo: complaint.complaintNo },
        link: `/complaints/${complaint._id}`,
      });
      realtime.toScope(complaint, "complaint:new", listItem(complaint, maps));
      if (ai)
        await UsageEvent.create({
          type: accepted ? "complaint_ai_accepted" : "complaint_ai_changed",
          userId: user._id,
          jurisdictionId,
          props: {
            suggested: ai.category,
            chosen: input.category,
            confidence: Math.round(ai.confidence * 100) / 100,
            modelVersion: ai.modelVersion.slice(0, 40),
          },
        });
    } catch (err) {
      logger.error({ err }, "complaint side effects failed");
    }
    return citizenView(complaint, maps);
  }

  // --- citizen reads --------------------------------------------------------------------------

  async function mine(userId, { status, page }) {
    const filter = { citizenId: userId, ...(status ? { status: STATUS_FILTER[status] } : {}) };
    const docs = await Complaint.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE + 1)
      .select("-timeline -aiSuggestion")
      .lean();
    const more = docs.length > PAGE_SIZE;
    const items = docs.slice(0, PAGE_SIZE);
    const maps = await lookups(items);
    return { items: items.map((c) => listItem(c, maps)), nextPage: more ? page + 1 : null };
  }

  /** Owner → citizen view; in-scope authority/admin → staff view; anyone else → 404/403. */
  async function detail(user, id) {
    if (user.role === "citizen") {
      const c = await Complaint.findOne({ _id: id, citizenId: user._id }).lean();
      if (!c) throw new AppError("NOT_FOUND", "complaint_not_found");
      return citizenView(c, await lookups([c]));
    }
    const c = await Complaint.findById(id).lean();
    if (!c) throw new AppError("NOT_FOUND", "complaint_not_found");
    assertInScope(user, c);
    return staffView(c, await lookups([c]));
  }

  // --- reopen (docs/05 §5.6.1 "RESOLVED → ASSIGNED") -------------------------------------------

  async function reopen(user, id, { reason }) {
    const c = await Complaint.findOne({ _id: id, citizenId: user._id }).lean();
    if (!c) throw new AppError("NOT_FOUND", "complaint_not_found");
    const state = reopenState(c);
    if (c.status !== "RESOLVED") throw new AppError("CONFLICT", "reopen_not_resolved");
    if (c.reopenCount >= MAX_REOPENS) throw new AppError("CONFLICT", "reopen_limit");
    if (!state.canReopen) throw new AppError("CONFLICT", "reopen_expired");

    const now = new Date();
    // Optimistic check: only if nobody changed it since we read it (docs/05 §5.6.1).
    const updated = await Complaint.findOneAndUpdate(
      {
        _id: c._id,
        citizenId: user._id,
        status: "RESOLVED",
        reopenCount: c.reopenCount,
        [`timeline.${MAX_TIMELINE_EVENTS - 1}`]: { $exists: false },
      },
      {
        $set: { status: "ASSIGNED", statusChangedAt: now },
        $inc: { reopenCount: 1 },
        $push: {
          timeline: {
            type: "reopened",
            fromStatus: "RESOLVED",
            toStatus: "ASSIGNED",
            text: reason,
            visibility: "public",
            actorId: user._id,
            actorRole: "citizen",
            at: now,
          },
        },
      },
      { new: true },
    ).lean();
    if (!updated) throw new AppError("CONFLICT", "complaint_changed");

    const maps = await lookups([updated]);
    realtime.toScope(updated, "complaint:updated", {
      ...listItem(updated, maps),
      reopened: true,
    });
    return citizenView(updated, maps);
  }

  // --- S-10 step 4 ----------------------------------------------------------------------------

  async function routePreview(user, { category, lat, lng }) {
    const location = lat === undefined ? null : { lat, lng };
    const { jurisdictionId, jurisdictionAncestors } = await locate(user, location);
    const route = await routeDepartment(category, jurisdictionAncestors);
    const [dept, village] = await Promise.all([
      route ? Department.findById(route.departmentId).select("name").lean() : null,
      Jurisdiction.findById(jurisdictionId).select("name").lean(),
    ]);
    return {
      department: dept ? { id: String(dept._id), name: dept.name } : null,
      village: village ? { id: String(village._id), name: village.name } : null,
    };
  }

  return { classify, create, mine, detail, reopen, routePreview };
}
