import { AppError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";
import { requestLanguage, translate } from "../lib/messages.js";

export function notFound(_req, _res, next) {
  next(new AppError("NOT_FOUND"));
}

// Renders every error in the envelope from docs/02 §7.1, in the request language.
export function errorHandler(err, req, res, _next) {
  let appErr;
  if (err instanceof AppError) appErr = err;
  else if (err?.type === "entity.parse.failed")
    appErr = new AppError("VALIDATION_ERROR", "malformed_json");
  else if (err?.type === "entity.too.large") appErr = new AppError("VALIDATION_ERROR");
  else appErr = new AppError("INTERNAL");

  if (appErr.status >= 500) (req.log || logger).error({ err }, "request failed");

  const lang = requestLanguage(req);
  const body = {
    error: {
      code: appErr.code,
      message: translate(appErr.messageKey, lang) || appErr.messageKey,
    },
  };
  if (appErr.details) body.error.details = appErr.details;
  res.status(appErr.status).json(body);
}
