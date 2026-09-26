import C from "../config/constants.js";
import { logger } from "./logger.js";

export const CLASSIFY_TIMEOUT_MS = 8000; // docs/02 §8.2
// Sahayak waits longer than the classifier: an LLM reply takes a few seconds (docs/01 §8.2 p90
// < 6 s); the AI service gives up on the LLM after 12 s.
export const SAHAYAK_TIMEOUT_MS = 15000;

/**
 * Client for the internal Django AI service (docs/02 §7.3). AI is optional (docs/02 §1.3): every
 * failure — not configured, timeout, 5xx, a malformed answer — returns null and is only logged,
 * so the complaint flow falls back to manual categories.
 */
export function createAiClient({
  env,
  fetchImpl = fetch,
  timeoutMs = CLASSIFY_TIMEOUT_MS,
  sahayakTimeoutMs = SAHAYAK_TIMEOUT_MS,
}) {
  const base = env.AI_BASE_URL?.replace(/\/+$/, "");
  const headers = { "X-Internal-Key": env.AI_INTERNAL_KEY ?? "" };
  const configured = Boolean(base && env.AI_INTERNAL_KEY);

  async function request(path, init, deadline) {
    return fetchImpl(`${base}${path}`, {
      ...init,
      headers: { ...headers, ...init?.headers },
      signal: AbortSignal.timeout(Math.max(1, deadline - Date.now())),
    });
  }

  /** → { category, confidence, top3, modelVersion, inferenceMs } or null */
  async function classify(imageUrl) {
    if (!configured) return null;
    const deadline = Date.now() + timeoutMs;
    const init = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl }),
    };
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const res = await request("/internal/classify", init, deadline);
        if (res.ok) return parseSuggestion(await res.json());
        // 4xx (bad image, host not allowed) won't get better on a retry; neither will 503.
        logger.warn({ status: res.status }, "AI classify refused");
        return null;
      } catch (err) {
        // One retry for a quick connection failure (a waking Render instance resets the
        // connection); never after a timeout, since the whole call has an 8 s budget.
        const timedOut = err?.name === "TimeoutError" || err?.name === "AbortError";
        if (timedOut || attempt === 2 || deadline - Date.now() < 1000) {
          logger.warn({ err: err?.message, timedOut }, "AI classify failed");
          return null;
        }
      }
    }
    return null;
  }

  /** Warm-up ping when the wizard opens (docs/02 §12): wakes a sleeping instance. */
  async function health() {
    if (!configured) return { ok: false, modelVersion: null };
    try {
      const res = await request("/internal/health", {}, Date.now() + timeoutMs);
      if (!res.ok) return { ok: false, modelVersion: null };
      const body = await res.json();
      return { ok: true, modelVersion: body?.modelVersion ?? null };
    } catch {
      return { ok: false, modelVersion: null };
    }
  }

  /**
   * POST /internal/sahayak/reply (docs/02 §7.3). Never throws.
   * → { ok: true, reply } or { ok: false, reason: "resting" | "failed" }
   *   "resting": no AI service or no LLM configured; "failed": timeout, 5xx or a bad answer.
   * No retry: an LLM call costs money and a retry would double the wait.
   */
  async function sahayakReply(payload) {
    if (!configured) return { ok: false, reason: "resting" };
    try {
      const res = await request(
        "/internal/sahayak/reply",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
        Date.now() + sahayakTimeoutMs,
      );
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        const code = body?.error?.code;
        logger.warn({ status: res.status, code }, "Sahayak refused");
        return { ok: false, reason: code === "LLM_NOT_CONFIGURED" ? "resting" : "failed" };
      }
      const reply = parseSahayakReply(body);
      if (!reply) {
        logger.warn("Sahayak answered with an invalid body");
        return { ok: false, reason: "failed" };
      }
      return { ok: true, reply };
    } catch (err) {
      logger.warn({ err: err?.message }, "Sahayak call failed");
      return { ok: false, reason: "failed" };
    }
  }

  return { configured, classify, health, sahayakReply };
}

const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const num = (v) => (Number.isFinite(v) ? Math.round(v) : undefined);

/** Accepts only a well-formed reply; anything else counts as "failed". */
export function parseSahayakReply(body) {
  if (!body || !C.chatIntents.includes(body.intent)) return null;
  const text = str(body.text, 4000);
  if (!text) return null;
  const list = (v, max, n) =>
    Array.isArray(v)
      ? v
          .map((x) => str(x, max))
          .filter(Boolean)
          .slice(0, n)
      : [];
  const reply = {
    intent: body.intent,
    text,
    cards: list(body.cards, 80, 3),
    chips: body.intent === "need_info" ? list(body.chips, 60, 5) : [],
    letter: null,
    llm: {
      provider: str(body.llm?.provider, 40) || undefined,
      model: str(body.llm?.model, 80) || undefined,
      tokensIn: num(body.llm?.tokensIn),
      tokensOut: num(body.llm?.tokensOut),
      latencyMs: num(body.llm?.latencyMs),
    },
  };
  if (body.intent === "letter_ready") {
    const l = body.letter ?? {};
    const letter = {
      to: str(l.to, 300),
      subject: str(l.subject, 200),
      body: str(l.body, 3000),
      applicantName: str(l.applicantName, 120),
      includeMobile: l.includeMobile === true,
    };
    if (!letter.to || !letter.subject || !letter.body || !letter.applicantName) return null;
    reply.letter = letter;
  }
  return reply;
}

const isConfidence = (v) => typeof v === "number" && v >= 0 && v <= 1;
const isCategory = (v) => C.complaintCategories.includes(v);

/** Only a well-formed answer becomes a suggestion; anything else counts as "no suggestion". */
export function parseSuggestion(body) {
  if (!body || !isCategory(body.category) || !isConfidence(body.confidence)) return null;
  if (typeof body.modelVersion !== "string" || !body.modelVersion) return null;
  const top3 = Array.isArray(body.top3)
    ? body.top3
        .filter((t) => isCategory(t?.category) && isConfidence(t?.confidence))
        .slice(0, 3)
        .map((t) => ({ category: t.category, confidence: t.confidence }))
    : [];
  return {
    category: body.category,
    confidence: body.confidence,
    top3,
    modelVersion: body.modelVersion.slice(0, 60),
    inferenceMs: Number.isFinite(body.inferenceMs) ? Math.round(body.inferenceMs) : undefined,
  };
}
