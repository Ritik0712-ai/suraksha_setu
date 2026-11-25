import cron from "node-cron";
import { logger } from "../lib/logger.js";
import { autoCloseStaleSos } from "./sosJobs.js";
import { cleanupStaleUploads } from "./uploadJobs.js";
import { keepAwakeTick } from "./keepAwake.js";
import { retainAuditLogs, retainComplaints, retainSos } from "./retention.js";

/** Background jobs (docs/02 §4.1 node-cron). Runs only in the server process, never in tests. */
export function startJobs({ realtime, storage, publicUrl, retentionEnabled }) {
  const task = cron.schedule("*/10 * * * *", async () => {
    try {
      const closed = await autoCloseStaleSos({ realtime });
      if (closed) logger.info({ closed }, "auto-closed stale SOS");
    } catch (err) {
      logger.error({ err }, "SOS auto-close job failed");
    }
  });
  // Hourly: photos uploaded but never attached to a complaint (doc 06 task 4B.9).
  const uploads = cron.schedule("17 * * * *", async () => {
    try {
      const { removed } = await cleanupStaleUploads({ storage });
      if (removed) logger.info({ removed }, "deleted stale uploads");
    } catch (err) {
      logger.error({ err }, "uploads cleanup job failed");
    }
  });
  // Daytime self-ping so Render's free plan doesn't put the API to sleep (keepAwake.js).
  const awake = cron.schedule("*/10 * * * *", () => keepAwakeTick({ publicUrl }));
  const stopRetention = retentionEnabled ? scheduleRetention(storage) : null;
  return () => {
    task.stop();
    uploads.stop();
    awake.stop();
    stopRetention?.();
  };
}

function scheduleRetention(storage) {
  // Run within the usual daytime uptime window on Render.
  const retention = cron.schedule(
    "25 10 * * *",
    async () => {
      const results = await Promise.allSettled([retainSos(), retainComplaints({ storage })]);
      results.forEach((result, index) => {
        const job = index === 0 ? "SOS" : "complaints";
        if (result.status === "fulfilled") logger.info({ job, ...result.value }, "retention run");
        else logger.error({ job, errorType: result.reason?.name }, "retention failed");
      });
    },
    { timezone: "Asia/Kolkata", noOverlap: true },
  );
  // Retry on each day of the first week in case the free service slept on the first day.
  const audit = cron.schedule(
    "35 10 1-7 * *",
    async () => {
      try {
        logger.info(await retainAuditLogs(), "audit log retention run");
      } catch (err) {
        logger.error({ errorType: err.name }, "audit log retention failed");
      }
    },
    { timezone: "Asia/Kolkata", noOverlap: true },
  );
  return () => {
    retention.stop();
    audit.stop();
  };
}
