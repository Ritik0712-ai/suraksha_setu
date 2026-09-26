import { createServer } from "node:http";
import { loadEnv } from "./config/env.js";
import { createApp } from "./app.js";
import { connectDb } from "./db/connect.js";
import { logger } from "./lib/logger.js";

const env = loadEnv();
const app = createApp({ env });
const server = createServer(app);

if (env.MONGODB_URI) {
  connectDb(env.MONGODB_URI, { production: env.NODE_ENV === "production" }).catch((err) => {
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
