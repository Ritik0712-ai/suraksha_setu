import cron from "node-cron";
import { logger } from "../lib/logger.js";
import { autoCloseStaleSos } from "./sosJobs.js";

/** Background jobs (docs/02 §4.1 node-cron). Runs only in the server process, never in tests. */
export function startJobs({ realtime }) {
  const task = cron.schedule("*/10 * * * *", async () => {
    try {
      const closed = await autoCloseStaleSos({ realtime });
      if (closed) logger.info({ closed }, "auto-closed stale SOS");
    } catch (err) {
      logger.error({ err }, "SOS auto-close job failed");
    }
  });
  return () => task.stop();
}
