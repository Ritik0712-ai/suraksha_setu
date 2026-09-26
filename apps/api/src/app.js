import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import mongoSanitize from "express-mongo-sanitize";
import { pinoHttp } from "pino-http";
import { logger } from "./lib/logger.js";
import { createMailer } from "./lib/mailer.js";
import { createAuthLimiters } from "./middleware/rateLimits.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import { createAuthService } from "./modules/auth/service.js";
import { authRouter } from "./modules/auth/routes.js";
import { usersRouter } from "./modules/users/routes.js";
import { adminRouter } from "./modules/admin/routes.js";
import { jurisdictionsRouter } from "./modules/jurisdictions/routes.js";
import { createSosService } from "./modules/sos/service.js";
import { sosRouter, trackRouter } from "./modules/sos/routes.js";
import { createComplaintService } from "./modules/complaints/service.js";
import { complaintsRouter, filesRouter } from "./modules/complaints/routes.js";
import { createAiClient } from "./lib/aiClient.js";
import { noopRealtime } from "./lib/realtime.js";
import { createStorage } from "./lib/storage.js";
import { healthRouter } from "./routes/health.js";

/**
 * @param deps.env         parsed env (config/env.js)
 * @param deps.fetchImpl   injectable fetch (health check)
 * @param deps.mailer      injectable mailer ({ send(to, subject, text) })
 * @param deps.realtime    Socket.IO emitter (lib/realtime.js); a no-op when omitted
 * @param deps.rateLimits  false disables auth rate limits (tests of other behaviour)
 * @param deps.storage     photo storage (lib/storage.js); from env when omitted
 * @param deps.ai          AI service client (lib/aiClient.js); from env when omitted
 */
export function createApp({
  env,
  fetchImpl,
  mailer,
  realtime = noopRealtime,
  rateLimits = true,
  storage = createStorage(env, { fetchImpl }),
  ai = createAiClient({ env, fetchImpl }),
} = {}) {
  const app = express();
  const mail = mailer ?? createMailer(env);
  const auth = createAuthService({ env, mailer: mail });
  const sos = createSosService({ env, mailer: mail, realtime });
  const complaints = createComplaintService({ realtime, storage, ai });
  const limiters = createAuthLimiters(rateLimits);

  app.disable("x-powered-by");
  app.set("trust proxy", 1); // Render / Vercel sit in front of us
  app.use(helmet());
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || env.CORS_ORIGINS.includes(origin)),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());
  app.use(mongoSanitize());
  app.use(pinoHttp({ logger }));

  const v1 = express.Router();
  v1.use("/health", healthRouter({ env, fetchImpl }));
  v1.use("/auth", authRouter({ env, auth, limiters }));
  v1.use("/users", usersRouter({ env, auth }));
  v1.use("/admin", adminRouter({ env, auth }));
  v1.use("/jurisdictions", jurisdictionsRouter());
  v1.use("/sos", sosRouter({ env, sos }));
  v1.use("/track", trackRouter({ sos, limiter: limiters.track }));
  v1.use("/complaints", complaintsRouter({ env, complaints, ai }));
  v1.use("/files", filesRouter({ storage }));
  app.use("/api/v1", v1);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
