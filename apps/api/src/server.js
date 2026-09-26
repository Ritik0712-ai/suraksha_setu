import { createServer } from "node:http";
import { loadEnv } from "./config/env.js";
import { createApp } from "./app.js";
import { connectDb } from "./db/connect.js";
import { startJobs } from "./jobs/scheduler.js";
import { logger } from "./lib/logger.js";
import { createRealtime } from "./lib/realtime.js";
import { createStorage } from "./lib/storage.js";

const env = loadEnv();

// Socket.IO must attach *after* the Express handler (it wraps existing request listeners and
// takes over /socket.io), but the app needs the emitter first — so it gets a delegating one.
let io = null;
const realtime = {
  toScope: (...args) => io?.toScope(...args),
  toUser: (...args) => io?.toUser(...args),
};
const storage = createStorage(env);
const server = createServer(createApp({ env, realtime, storage }));
io = createRealtime(server, env);

if (env.MONGODB_URI) {
  connectDb(env.MONGODB_URI, { production: env.NODE_ENV === "production" })
    .then(() => startJobs({ realtime, storage }))
    .catch((err) => {
      logger.error({ err }, "MongoDB connection failed");
      if (env.NODE_ENV === "production") process.exit(1);
    });
} else {
  logger.warn("MONGODB_URI not set — running without a database");
}

server.listen(env.PORT, () => logger.info(`API listening on :${env.PORT}`));

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => server.close(() => process.exit(0)));
}
