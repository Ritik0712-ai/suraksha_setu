import { Router } from "express";
import { z } from "zod";
import C from "../../config/constants.js";
import { toLatLng } from "../../lib/distance.js";
import { scopeFilter } from "../../lib/scope.js";
import { validate } from "../../middleware/validate.js";
import { Complaint } from "../../models/Complaint.js";
import { Department } from "../../models/Department.js";
import { Jurisdiction } from "../../models/Jurisdiction.js";
import { SosAlert } from "../../models/SosAlert.js";
import { UsageEvent } from "../../models/UsageEvent.js";
import { ChatMessage } from "../../models/ChatMessage.js";
import { Feedback } from "../../models/Feedback.js";
import { Scheme } from "../../models/Scheme.js";
import { User } from "../../models/User.js";

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);
const DAY_MS = 24 * 3600 * 1000;
const OPEN = C.complaintStatus.filter((s) => s !== "RESOLVED" && s !== "REJECTED");

async function names(model, ids, field = "name") {
  const docs = await model
    .find({ _id: { $in: [...new Set(ids.filter(Boolean).map(String))] } })
    .select(field)
    .lean();
  return new Map(docs.map((d) => [String(d._id), d[field]]));
}

/** GET /admin/overview — A-01 KPIs, active SOS, oldest waiting complaints, recent activity. */
async function overview(user) {
  const cScope = scopeFilter(user);
  const sScope = scopeFilter(user, { ignoreDepartment: true });
  const now = Date.now();
  const weekAgo = new Date(now - 7 * DAY_MS);
  const monthAgo = new Date(now - 30 * DAY_MS);

  const [open, resolvedWeek, activeSos, resolution, waiting, recentComplaints, recentSos] =
    await Promise.all([
      Complaint.countDocuments({ ...cScope, status: { $in: OPEN } }),
      Complaint.countDocuments({ ...cScope, status: "RESOLVED", resolvedAt: { $gte: weekAgo } }),
      SosAlert.find({ ...sScope, status: { $in: C.sosOpenStatus } })
        .sort({ triggeredAt: -1 })
        .limit(20)
        .lean(),
      Complaint.aggregate([
        { $match: { ...cScope, status: "RESOLVED", resolvedAt: { $gte: monthAgo } } },
        { $group: { _id: null, avg: { $avg: { $subtract: ["$resolvedAt", "$createdAt"] } } } },
      ]),
      Complaint.find({ ...cScope, status: { $in: ["SUBMITTED", "VERIFIED"] } })
        .sort({ createdAt: 1 })
        .limit(10)
        .select("complaintNo category status jurisdictionId createdAt landmark")
        .lean(),
      Complaint.aggregate([
        { $match: { ...cScope, updatedAt: { $gte: monthAgo } } },
        { $sort: { updatedAt: -1 } },
        { $limit: 50 },
        { $unwind: "$timeline" },
        {
          $match: {
            "timeline.type": { $in: ["created", "status_change", "assigned", "reopened"] },
          },
        },
        { $sort: { "timeline.at": -1 } },
        { $limit: 15 },
        {
          $project: {
            complaintNo: 1,
            category: 1,
            type: "$timeline.type",
            toStatus: "$timeline.toStatus",
            actorId: "$timeline.actorId",
            actorRole: "$timeline.actorRole",
            at: "$timeline.at",
          },
        },
      ]),
      SosAlert.find({ ...sScope, triggeredAt: { $gte: monthAgo } })
        .sort({ triggeredAt: -1 })
        .limit(15)
        .select("status triggeredAt resolvedAt jurisdictionId userId")
        .lean(),
    ]);

  const villages = await names(Jurisdiction, [
    ...activeSos.map((s) => s.jurisdictionId),
    ...waiting.map((c) => c.jurisdictionId),
    ...recentSos.map((s) => s.jurisdictionId),
  ]);
  const people = await names(User, [
    ...activeSos.map((s) => s.userId),
    ...recentComplaints.map((e) => e.actorId),
    ...recentSos.map((s) => s.userId),
  ]);

  const activity = [
    ...recentComplaints.map((e) => ({
      kind:
        e.type === "created"
          ? "complaint_new"
          : e.type === "reopened"
            ? "complaint_reopened"
            : "complaint_status",
      complaintId: String(e._id),
      complaintNo: e.complaintNo,
      category: e.category,
      status: e.toStatus ?? null,
      actorName: e.actorRole === "citizen" ? null : (people.get(String(e.actorId)) ?? null),
      at: e.at,
    })),
    ...recentSos.flatMap((s) => {
      const base = {
        sosId: String(s._id),
        village: villages.get(String(s.jurisdictionId)) ?? null,
      };
      const out = [{ ...base, kind: "sos_started", at: s.triggeredAt }];
      if (s.resolvedAt)
        out.push({ ...base, kind: "sos_ended", status: s.status, at: s.resolvedAt });
      return out;
    }),
  ]
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 15);

  const scope =
    user.role === "admin"
      ? null
      : (
          await Jurisdiction.find({ _id: { $in: user.authority?.jurisdictionIds ?? [] } })
            .select("name")
            .lean()
        ).map((x) => x.name);
  return {
    scope,
    kpis: {
      openComplaints: open,
      resolvedThisWeek: resolvedWeek,
      activeSos: activeSos.length,
      avgResolutionDays: resolution[0] ? Math.round((resolution[0].avg / DAY_MS) * 10) / 10 : null,
    },
    activeSos: activeSos.map((s) => ({
      id: String(s._id),
      status: s.status,
      name: people.get(String(s.userId)) ?? "",
      village: villages.get(String(s.jurisdictionId)) ?? null,
      triggeredAt: s.triggeredAt,
      lastLocation: toLatLng(s.lastLocation),
    })),
    needsAction: waiting.map((c) => ({
      id: String(c._id),
      complaintNo: c.complaintNo,
      category: c.category,
      status: c.status,
      village: villages.get(String(c.jurisdictionId)) ?? null,
      landmark: c.landmark ?? null,
      ageDays: Math.floor((now - new Date(c.createdAt)) / DAY_MS),
    })),
    activity,
  };
}

// --- analytics (docs/03 A-06) ---------------------------------------------------------------

const dayKey = {
  $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "Asia/Kolkata" },
};

async function analytics(user, { from, to }) {
  const cScope = scopeFilter(user);
  const sScope = scopeFilter(user, { ignoreDepartment: true });
  const range = { $gte: from, $lte: to };
  const inRange = { ...cScope, createdAt: range };

  const [byCategory, funnel, perDay, resolutionWeeks, sosDays, sosAck, ai, checks, topSchemes] =
    await Promise.all([
      Complaint.aggregate([
        { $match: inRange },
        { $group: { _id: "$category", count: { $sum: 1 } } },
      ]),
      // A complaint counts at every status it has ever reached.
      Complaint.aggregate([
        { $match: inRange },
        { $project: { reached: { $setUnion: ["$timeline.toStatus", []] } } },
        { $unwind: "$reached" },
        { $group: { _id: "$reached", count: { $sum: 1 } } },
      ]),
      Complaint.aggregate([
        { $match: inRange },
        { $group: { _id: dayKey, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      Complaint.aggregate([
        { $match: { ...cScope, status: "RESOLVED", resolvedAt: range } },
        {
          $group: {
            _id: {
              $dateToString: {
                format: "%G-W%V",
                date: "$resolvedAt",
                timezone: "Asia/Kolkata",
              },
            },
            avgMs: { $avg: { $subtract: ["$resolvedAt", "$createdAt"] } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      SosAlert.aggregate([
        { $match: { ...sScope, triggeredAt: range } },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$triggeredAt", timezone: "Asia/Kolkata" },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      SosAlert.aggregate([
        { $match: { ...sScope, triggeredAt: range, acknowledgedAt: { $ne: null } } },
        {
          $group: {
            _id: null,
            avgMs: { $avg: { $subtract: ["$acknowledgedAt", "$triggeredAt"] } },
          },
        },
      ]),
      Complaint.aggregate([
        { $match: { ...inRange, aiSuggestion: { $ne: null } } },
        {
          $group: {
            _id: null,
            withSuggestion: { $sum: 1 },
            accepted: { $sum: { $cond: [{ $eq: ["$categorySource", "ai_accepted"] }, 1, 0] } },
            corrected: {
              $sum: { $cond: [{ $eq: ["$categorySource", "authority_corrected"] }, 1, 0] },
            },
          },
        },
      ]),
      UsageEvent.countDocuments({ type: "eligibility_completed", createdAt: range }),
      UsageEvent.aggregate([
        { $match: { type: "scheme_view", createdAt: range } },
        { $group: { _id: "$props.slug", views: { $sum: 1 } } },
        { $sort: { views: -1 } },
        { $limit: 5 },
      ]),
    ]);

  const [sahayak, feedback] =
    user.role === "admin"
      ? await Promise.all([sahayakUsage(range), feedbackSummary(range)])
      : [null, null];
  const count = (list, key) => list.find((x) => x._id === key)?.count ?? 0;
  const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : null);
  const a = ai[0] ?? { withSuggestion: 0, accepted: 0, corrected: 0 };
  return {
    from,
    to,
    byCategory: C.complaintCategories.map((c) => ({ category: c, count: count(byCategory, c) })),
    funnel: ["SUBMITTED", "VERIFIED", "ASSIGNED", "IN_PROGRESS", "RESOLVED"].map((s) => ({
      status: s,
      count: count(funnel, s),
    })),
    complaintsPerDay: perDay.map((d) => ({ day: d._id, count: d.count })),
    resolutionByWeek: resolutionWeeks.map((w) => ({
      week: w._id,
      avgDays: Math.round((w.avgMs / DAY_MS) * 10) / 10,
      count: w.count,
    })),
    sosPerDay: sosDays.map((d) => ({ day: d._id, count: d.count })),
    sosAvgAckMinutes: sosAck[0] ? Math.round((sosAck[0].avgMs / 60000) * 10) / 10 : null,
    schemes: {
      checks,
      topViewed: topSchemes.map((s) => ({ slug: s._id, views: s.views })),
    },
    ai: {
      withSuggestion: a.withSuggestion,
      acceptedPct: pct(a.accepted, a.withSuggestion),
      correctedPct: pct(a.corrected, a.withSuggestion),
    },
    sahayak,
    feedback,
  };
}

/**
 * Sahayak usage and LLM cost for admins (docs/06 task 5.6: "cost per 100 messages measured").
 * Counts only — never message text. Multiply tokens by the provider's price to get the cost.
 */
async function sahayakUsage(range) {
  const [rows] = await ChatMessage.aggregate([
    { $match: { createdAt: range } },
    {
      $group: {
        _id: null,
        userMessages: { $sum: { $cond: [{ $eq: ["$role", "user"] }, 1, 0] } },
        llmReplies: { $sum: { $cond: [{ $ne: [{ $ifNull: ["$llm", null] }, null] }, 1, 0] } },
        letters: { $sum: { $cond: [{ $eq: ["$intent", "letter_ready"] }, 1, 0] } },
        emergencies: { $sum: { $cond: [{ $eq: ["$intent", "emergency"] }, 1, 0] } },
        tokensIn: { $sum: { $ifNull: ["$llm.tokensIn", 0] } },
        tokensOut: { $sum: { $ifNull: ["$llm.tokensOut", 0] } },
        latencyMs: { $avg: "$llm.latencyMs" },
        users: { $addToSet: "$userId" },
      },
    },
  ]);
  const r = rows ?? { userMessages: 0, llmReplies: 0, letters: 0, emergencies: 0 };
  const per100 = (n) => (r.llmReplies ? Math.round((n / r.llmReplies) * 100) : null);
  return {
    userMessages: r.userMessages,
    llmReplies: r.llmReplies,
    letters: r.letters,
    emergencies: r.emergencies,
    users: r.users?.length ?? 0,
    tokensInPer100: per100(r.tokensIn ?? 0),
    tokensOutPer100: per100(r.tokensOut ?? 0),
    avgLatencyMs: r.latencyMs ? Math.round(r.latencyMs) : null,
  };
}

/**
 * "Was this helpful?" votes (admin only, pilot data for the usability report). Votes changed
 * inside the range count with their latest answer.
 */
async function feedbackSummary(range) {
  const rows = await Feedback.aggregate([
    { $match: { updatedAt: range } },
    {
      $group: {
        _id: {
          target: "$target",
          targetId: { $cond: [{ $eq: ["$target", "scheme"] }, "$targetId", null] },
        },
        helpful: { $sum: { $cond: ["$helpful", 1, 0] } },
        notHelpful: { $sum: { $cond: ["$helpful", 0, 1] } },
      },
    },
  ]);
  const sahayakRow = rows.find((r) => r._id.target === "sahayak_reply");
  const schemeRows = rows
    .filter((r) => r._id.target === "scheme")
    .sort((a, b) => b.helpful + b.notHelpful - (a.helpful + a.notHelpful))
    .slice(0, 10);
  const schemeNames = await names(
    Scheme,
    schemeRows.map((r) => r._id.targetId),
  );
  return {
    sahayak: { helpful: sahayakRow?.helpful ?? 0, notHelpful: sahayakRow?.notHelpful ?? 0 },
    schemes: schemeRows.map((r) => ({
      id: String(r._id.targetId),
      name: schemeNames.get(String(r._id.targetId)) ?? null,
      helpful: r.helpful,
      notHelpful: r.notHelpful,
    })),
  };
}

const analyticsQuery = z
  .object({
    from: z.coerce.date(),
    to: z.coerce.date(),
  })
  .transform((v) => ({ from: v.from, to: new Date(v.to.getTime() + DAY_MS - 1) }))
  .refine((v) => v.to >= v.from && v.to - v.from <= 400 * DAY_MS, {
    message: "invalid_range",
    path: ["to"],
  });

/** Authority + admin dashboards (docs/02 §7.2: /admin/overview, /admin/analytics). */
export function dashboardRouter() {
  const router = Router();
  router.get(
    "/overview",
    wrap(async (req, res) => res.json({ data: await overview(req.user) })),
  );
  // Filter options for A-02: departments and villages the user can see.
  router.get(
    "/meta",
    wrap(async (req, res) => {
      const mine = req.user.authority?.jurisdictionIds ?? [];
      const inScope =
        req.user.role === "admin"
          ? {}
          : { $or: [{ _id: { $in: mine } }, { ancestors: { $in: mine } }] };
      const [villages, depts] = await Promise.all([
        Jurisdiction.find({ ...inScope, type: "village", active: true })
          .select("name")
          .sort({ "name.en": 1 })
          .lean(),
        Department.find({ active: true }).select("name code").sort({ code: 1 }).lean(),
      ]);
      const own = req.user.authority?.departmentId ? String(req.user.authority.departmentId) : null;
      res.json({
        data: {
          villages: villages.map((v) => ({ id: String(v._id), name: v.name })),
          departments: depts
            .filter((d) => !own || String(d._id) === own)
            .map((d) => ({ id: String(d._id), name: d.name, code: d.code })),
        },
      });
    }),
  );
  router.get(
    "/analytics",
    validate({ query: analyticsQuery }),
    wrap(async (req, res) => res.json({ data: await analytics(req.user, req.validatedQuery) })),
  );
  return router;
}
