import pino from "pino";

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
