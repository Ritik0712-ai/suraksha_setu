import cron from "node-cron";
import { logger } from "../lib/logger.js";
import { autoCloseStaleSos } from "./sosJobs.js";
import { cleanupStaleUploads } from "./uploadJobs.js";

/** Background jobs (docs/02 §4.1 node-cron). Runs only in the server process, never in tests. */
export function startJobs({ realtime, storage }) {
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
  return () => {
    task.stop();
    uploads.stop();
  };
}
