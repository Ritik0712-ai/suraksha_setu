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
import { healthRouter } from "./routes/health.js";

/**
 * @param deps.env         parsed env (config/env.js)
 * @param deps.fetchImpl   injectable fetch (health check)
 * @param deps.mailer      injectable mailer ({ send(to, subject, text) })
 * @param deps.rateLimits  false disables auth rate limits (tests of other behaviour)
 */
export function createApp({ env, fetchImpl, mailer, rateLimits = true } = {}) {
  const app = express();
  const auth = createAuthService({ env, mailer: mailer ?? createMailer(env) });
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
  app.use("/api/v1", v1);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
