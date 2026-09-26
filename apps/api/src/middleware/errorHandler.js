import { AppError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

export function notFound(req, _res, next) {
  next(new AppError("NOT_FOUND", `No route for ${req.method} ${req.path}`));
}

// Renders every error in the envelope from docs/02 §7.1.
export function errorHandler(err, req, res, _next) {
  const appErr =
    err instanceof AppError
      ? err
      : err?.type === "entity.parse.failed"
        ? new AppError("VALIDATION_ERROR", "Malformed JSON body")
        : new AppError("INTERNAL", "Something went wrong");

  if (appErr.status >= 500) (req.log || logger).error({ err }, "request failed");

  const body = { error: { code: appErr.code, message: appErr.message } };
  if (appErr.details) body.error.details = appErr.details;
  res.status(appErr.status).json(body);
}
