import { logger } from "../lib/logger.js";

// Render's free plan puts the API to sleep after 15 minutes without traffic, and the first
// request then waits about a minute. GitHub's scheduled keep-alive turned out to run only a few
// times a day (GitHub delays and skips schedules on quiet repositories), so the API also keeps
// itself awake: every 10 minutes in the daytime it calls its own public URL, which Render counts
// as traffic. At night it stops and the service sleeps, which keeps the API at about 520 of the
// 750 free hours a month and leaves the rest for the AI service (it wakes on demand).
// The first request of the morning (a user or the GitHub workflow) wakes it again.

export const AWAKE_FROM_MIN = 6 * 60 + 30; // 06:30 IST
export const AWAKE_UNTIL_MIN = 23 * 60 + 10; // 23:10 IST

/** Minutes since midnight in India (UTC+05:30, no daylight saving). */
export function istMinutes(now = new Date()) {
  return (now.getUTCHours() * 60 + now.getUTCMinutes() + 330) % 1440;
}

export function isDaytime(now = new Date()) {
  const m = istMinutes(now);
  return m >= AWAKE_FROM_MIN && m < AWAKE_UNTIL_MIN;
}

/** One tick of the job: pings our own public health URL in the daytime. Never throws. */
export async function keepAwakeTick({ publicUrl, fetchImpl = fetch, now = new Date() }) {
  if (!publicUrl || !isDaytime(now)) return false;
  try {
    await fetchImpl(`${publicUrl.replace(/\/+$/, "")}/api/v1/health`, {
      signal: AbortSignal.timeout(30_000),
    });
    return true;
  } catch (err) {
    logger.warn({ err: err?.message }, "keep-awake ping failed");
    return false;
  }
}
