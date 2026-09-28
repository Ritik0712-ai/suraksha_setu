import { Router } from "express";
import { dbStatus } from "../db/connect.js";

/**
 * GET /api/v1/health → { status, db, ai } (docs/02 §7.2, used by the keep-alive and Render).
 * The AI service is only checked with ?ai=1: a check wakes it, and keeping both free services
 * awake all day would use more than Render's 750 free hours a month (docs/runbook.md §2.4).
 * Without it, ai is "unchecked". Its state never makes the API report itself as down.
 */
export function healthRouter({ env, fetchImpl = fetch }) {
  const router = Router();

  router.get("/", async (req, res) => {
    const db = dbStatus();
    const ai = req.query.ai === "1" ? await checkAi(env, fetchImpl) : "unchecked";
    res.status(db === "up" ? 200 : 503).json({ status: db === "up" ? "ok" : "degraded", db, ai });
  });

  return router;
}

async function checkAi(env, fetchImpl) {
  if (!env.AI_BASE_URL) return "unconfigured";
  try {
    const r = await fetchImpl(`${env.AI_BASE_URL}/internal/health`, {
      headers: { "X-Internal-Key": env.AI_INTERNAL_KEY ?? "" },
      signal: AbortSignal.timeout(3000),
    });
    return r.ok ? "up" : "down";
  } catch {
    return "down";
  }
}
