import { Router } from "express";
import C from "../../config/constants.js";
import { isEmergencyMessage } from "../../../../../shared/emergencyCheck.js";
import { AppError } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { requestLanguage } from "../../lib/messages.js";
import { istDayStart } from "../../lib/time.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { ChatMessage } from "../../models/ChatMessage.js";
import { ChatSession, chatExpiry } from "../../models/ChatSession.js";
import { Jurisdiction } from "../../models/Jurisdiction.js";
import { Scheme } from "../../models/Scheme.js";
import { UsageEvent } from "../../models/UsageEvent.js";
import { User } from "../../models/User.js";
import {
  createSessionBody,
  letterBody,
  letterParams,
  messageBody,
  sessionParams,
} from "./schemas.js";
import {
  EMERGENCY_NOTICE,
  LETTER_OPENER,
  LETTER_TITLES,
  NEW_CHAT_TITLE,
  SCHEME_CHIPS,
  SCHEME_OPENER,
} from "./texts.js";

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);
const LIMIT = C.sahayak.dailyMessageLimit;
const LIST_LIMIT = 20; // docs/02 §7.2 "last 20"
const pick = (v, lang) => v?.[lang] || v?.hi || v?.en || "";

/** "dd/mm/yyyy" in IST, for the letter date line (docs/03 S-26). */
export function istDate(now = new Date()) {
  const d = new Date(now.getTime() + 330 * 60 * 1000);
  const two = (n) => String(n).padStart(2, "0");
  return `${two(d.getUTCDate())}/${two(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

async function usedToday(userId) {
  return ChatMessage.countDocuments({ userId, role: "user", createdAt: { $gte: istDayStart() } });
}

/** Village, Gram Panchayat, block and district names for the prompt (never free text). */
async function placeOf(jurisdictionId, lang) {
  if (!jurisdictionId) return {};
  const j = await Jurisdiction.findById(jurisdictionId).select("name type ancestors").lean();
  if (!j) return {};
  const up = await Jurisdiction.find({ _id: { $in: j.ancestors } })
    .select("name type")
    .lean();
  const byType = Object.fromEntries([...up, j].map((x) => [x.type, pick(x.name, lang)]));
  return {
    village: byType.village ?? "",
    gp: byType.gram_panchayat ?? "",
    block: byType.block ?? "",
    district: byType.district ?? "",
  };
}

/** Scheme cards carry what S-25 shows: name + benefit line + link (published schemes only). */
async function cardsFor(messages) {
  const slugs = [...new Set(messages.flatMap((m) => (m.cards ?? []).map((c) => c.slug)))];
  if (!slugs.length) return new Map();
  const found = await Scheme.find({ slug: { $in: slugs }, status: "published" })
    .select("slug name benefitShort")
    .lean();
  return new Map(
    found.map((s) => [s.slug, { slug: s.slug, name: s.name, benefitShort: s.benefitShort }]),
  );
}

function messageView(m, cards, chips) {
  return {
    id: String(m._id),
    role: m.role,
    text: m.text,
    intent: m.intent ?? null,
    cards: (m.cards ?? []).map((c) => cards.get(c.slug)).filter(Boolean),
    letter: m.letter ?? null,
    letterEdited: m.letterEdited ?? null,
    createdAt: m.createdAt,
    // Quick replies are only for the newest assistant question; they aren't stored.
    ...(chips ? { chips } : {}),
  };
}

function sessionView(s, extra = {}) {
  return {
    id: String(s._id),
    mode: s.mode,
    letterType: s.letterType ?? null,
    schemeId: s.schemeId ? String(s.schemeId) : null,
    title: s.title,
    messageCount: s.messageCount,
    lastMessageAt: s.lastMessageAt,
    ...extra,
  };
}

async function ownSession(req) {
  const s = await ChatSession.findOne({ _id: req.params.id, userId: req.user._id });
  if (!s) throw new AppError("NOT_FOUND", "chat_not_found");
  return s;
}

/** /api/v1/chat — Sahayak (docs/02 §7.2 "Sahayak (M7)", docs/05 §5.14–5.15). Citizens only. */
export function chatRouter({ env, ai }) {
  const router = Router();
  router.use(requireAuth(env), requireRole("citizen"));

  // Wakes the (free, sleeping) AI service when Sahayak opens, so it is up by the time the first
  // question is typed. Answers at once; the wake-up continues in the background.
  router.get("/warmup", (_req, res) => {
    ai.health().catch(() => {});
    res.json({ data: { ok: true } });
  });

  // Start a session. Letter and scheme sessions open with a fixed first question (no LLM call).
  router.post(
    "/sessions",
    validate({ body: createSessionBody }),
    wrap(async (req, res) => {
      const lang = requestLanguage(req);
      const { mode, schemeId, letterType } = req.body;
      let title = pick(NEW_CHAT_TITLE, lang);
      let opener = null;
      if (mode === "scheme_help") {
        const scheme = await Scheme.findOne({ _id: schemeId, status: "published" })
          .select("name")
          .lean();
        if (!scheme) throw new AppError("NOT_FOUND", "scheme_not_found");
        const name = pick(scheme.name, lang);
        title = name.slice(0, 80);
        opener = { text: SCHEME_OPENER[lang](name), chips: SCHEME_CHIPS[lang] };
      } else if (mode === "letter") {
        title = pick(LETTER_TITLES[letterType], lang);
        const me = await User.findById(req.user._id).select("name").lean();
        opener = { text: LETTER_OPENER[lang], chips: me?.name ? [me.name.slice(0, 60)] : [] };
      }
      const now = new Date();
      const session = await ChatSession.create({
        userId: req.user._id,
        mode,
        schemeId: mode === "scheme_help" ? schemeId : null,
        letterType: mode === "letter" ? letterType : null,
        title,
        messageCount: opener ? 1 : 0,
        lastMessageAt: now,
        expireAt: chatExpiry(now),
      });
      const messages = [];
      if (opener) {
        const m = await ChatMessage.create({
          sessionId: session._id,
          userId: req.user._id,
          role: "assistant",
          text: opener.text,
          intent: "need_info",
          expireAt: session.expireAt,
        });
        messages.push(messageView(m.toObject(), new Map(), opener.chips));
      }
      res.status(201).json({
        data: sessionView(session, {
          messages,
          remainingToday: Math.max(0, LIMIT - (await usedToday(req.user._id))),
        }),
      });
    }),
  );

  router.get(
    "/sessions",
    wrap(async (req, res) => {
      const sessions = await ChatSession.find({ userId: req.user._id })
        .sort({ lastMessageAt: -1 })
        .limit(LIST_LIMIT)
        .lean();
      res.json({ data: sessions.map((s) => sessionView(s)) });
    }),
  );

  router.get(
    "/sessions/:id",
    validate({ params: sessionParams }),
    wrap(async (req, res) => {
      const s = await ownSession(req);
      const messages = await ChatMessage.find({ sessionId: s._id }).sort({ createdAt: 1 }).lean();
      const cards = await cardsFor(messages);
      res.json({
        data: sessionView(s, {
          messages: messages.map((m) => messageView(m, cards)),
          remainingToday: Math.max(0, LIMIT - (await usedToday(req.user._id))),
        }),
      });
    }),
  );

  router.post(
    "/sessions/:id/messages",
    validate({ params: sessionParams, body: messageBody }),
    wrap(async (req, res) => {
      const lang = requestLanguage(req);
      const s = await ownSession(req);
      const { text, skipEmergencyCheck } = req.body;
      const used = await usedToday(req.user._id);
      const base = { sessionId: s._id, userId: req.user._id };

      const save = async (reply, extra = {}) => {
        const now = new Date();
        const expireAt = chatExpiry(now);
        const userMsg = await ChatMessage.create({ ...base, role: "user", text, expireAt });
        const replyMsg = await ChatMessage.create({ ...base, ...reply, expireAt });
        const isFirstUserMessage = !(await ChatMessage.exists({
          ...base,
          role: "user",
          _id: { $ne: userMsg._id },
        }));
        s.messageCount += 2;
        s.lastMessageAt = now;
        s.expireAt = expireAt;
        if (s.mode === "general" && isFirstUserMessage) s.title = text.slice(0, 80);
        await s.save();
        const cards = await cardsFor([replyMsg]);
        res.json({
          data: {
            session: sessionView(s),
            userMessage: messageView(userMsg.toObject(), cards),
            reply: messageView(replyMsg.toObject(), cards, extra.chips),
            remainingToday: Math.max(0, LIMIT - used - 1),
          },
        });
      };

      // 1. Emergency words → the SOS card at once, before (and instead of) the LLM
      //    (docs/02 §4.4). Never blocked by the daily limit.
      if (!skipEmergencyCheck && isEmergencyMessage(text, C.sahayak)) {
        return save({ role: "notice", intent: "emergency", text: EMERGENCY_NOTICE[lang] });
      }

      // 2. 30 messages per IST day (docs/02 SEC-06).
      if (used >= LIMIT) throw new AppError("RATE_LIMITED", "chat_limit");

      // 3. Ask the AI service with the last 10 turns (notices are app cards, not conversation).
      const history = (
        await ChatMessage.find({ sessionId: s._id, role: { $in: ["user", "assistant"] } })
          .sort({ createdAt: -1 })
          .limit(C.sahayak.historyMessages)
          .select("role text")
          .lean()
      )
        .reverse()
        .map((m) => ({ role: m.role, text: m.text }));
      const user = await User.findById(req.user._id).select("phone jurisdictionId").lean();
      const place = await placeOf(user?.jurisdictionId, lang);
      const result = await ai.sahayakReply({
        language: lang,
        mode: s.mode,
        history,
        message: text,
        ...(s.schemeId ? { schemeIds: [String(s.schemeId)] } : {}),
        ...(s.letterType ? { letterType: s.letterType } : {}),
        userContext: place,
      });
      if (!result.ok) {
        // Nothing is stored, so "Retry" resends the same message without duplicating it.
        throw new AppError(
          "AI_UNAVAILABLE",
          result.reason === "resting" ? "sahayak_resting" : "sahayak_failed",
          [{ field: "reason", issue: result.reason }],
        );
      }

      const r = result.reply;
      let letter = null;
      if (r.intent === "letter_ready" && r.letter) {
        // The app, not the model, fills date, place and phone (the phone never goes to the LLM).
        letter = {
          to: r.letter.to,
          subject: r.letter.subject,
          body: r.letter.body,
          applicantName: r.letter.applicantName,
          place: place.village || place.gp || "",
          date: istDate(),
          ...(r.letter.includeMobile && user?.phone
            ? { mobile: user.phone.replace(/^\+91/, "") }
            : {}),
        };
        UsageEvent.create({
          type: "letter_generated",
          userId: req.user._id,
          jurisdictionId: user?.jurisdictionId ?? null,
          props: { letterType: s.letterType ?? "none" },
        }).catch((err) => logger.warn({ err }, "usage event failed"));
      }
      return save(
        {
          role: "assistant",
          text: r.text,
          intent: r.intent,
          cards: r.cards.length ? r.cards.map((slug) => ({ type: "scheme", slug })) : undefined,
          letter,
          llm: r.llm,
        },
        { chips: r.chips },
      );
    }),
  );

  // S-26 "Edit": the user's own version of the letter is kept next to Sahayak's draft.
  router.put(
    "/sessions/:id/messages/:messageId/letter",
    validate({ params: letterParams, body: letterBody }),
    wrap(async (req, res) => {
      const s = await ownSession(req);
      const m = await ChatMessage.findOne({
        _id: req.params.messageId,
        sessionId: s._id,
        letter: { $ne: null },
      });
      if (!m) throw new AppError("NOT_FOUND", "letter_not_found");
      const { mobile, ...rest } = req.body;
      m.letterEdited = { ...rest, ...(mobile ? { mobile } : {}) };
      await m.save();
      res.json({ data: messageView(m.toObject(), await cardsFor([m])) });
    }),
  );

  router.delete(
    "/sessions/:id",
    validate({ params: sessionParams }),
    wrap(async (req, res) => {
      const s = await ownSession(req);
      await ChatMessage.deleteMany({ sessionId: s._id });
      await s.deleteOne();
      res.json({ data: { deleted: true } });
    }),
  );

  return router;
}
