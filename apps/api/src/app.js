import express from "express";
import helmet from "helmet";
import cors from "cors";
import mongoSanitize from "express-mongo-sanitize";
import { pinoHttp } from "pino-http";
import { logger } from "./lib/logger.js";
import { healthRouter } from "./routes/health.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";

export function createApp({ env, fetchImpl } = {}) {
  const app = express();

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
  app.use(mongoSanitize());
  app.use(pinoHttp({ logger }));

  const v1 = express.Router();
  v1.use("/health", healthRouter({ env, fetchImpl }));
  app.use("/api/v1", v1);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
