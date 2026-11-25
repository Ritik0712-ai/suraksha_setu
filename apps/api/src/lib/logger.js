import pino from "pino";

export function serializeRequest(req) {
  const pathname = URL.parse(req.url, "http://localhost")?.pathname ?? "/";
  return {
    id: req.id,
    method: req.method,
    url: /^\/api\/v1\/track\/[^/]+/i.test(pathname) ? "/api/v1/track/:token" : pathname,
  };
}

// PII redaction (docs/02 SEC-14). Coordinates are rounded where they are logged, not here.
export const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === "test" ? "silent" : "info"),
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "res.headers['set-cookie']",
      "*.password",
      "*.phone",
      "*.email",
      "*.token",
    ],
    censor: "[redacted]",
  },
});
