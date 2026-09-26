// Error codes and HTTP statuses from docs/02 §7.1.
export const ERROR_STATUS = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  TOKEN_EXPIRED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  ACCOUNT_LOCKED: 423,
  RATE_LIMITED: 429,
  INTERNAL: 500,
  AI_UNAVAILABLE: 503,
};

// Message key used when an error is thrown without one.
const DEFAULT_MESSAGE_KEY = {
  VALIDATION_ERROR: "validation",
  UNAUTHENTICATED: "unauthenticated",
  TOKEN_EXPIRED: "token_expired",
  FORBIDDEN: "forbidden",
  NOT_FOUND: "not_found",
  CONFLICT: "validation",
  ACCOUNT_LOCKED: "account_locked",
  RATE_LIMITED: "rate_limited",
  INTERNAL: "internal",
  AI_UNAVAILABLE: "internal",
};

/**
 * @param code        one of ERROR_STATUS
 * @param messageKey  key in lib/messages.js (translated per request); defaults per code
 * @param details     optional [{ field, issue }]
 */
export class AppError extends Error {
  constructor(code, messageKey, details) {
    const c = code in ERROR_STATUS ? code : "INTERNAL";
    super(messageKey || DEFAULT_MESSAGE_KEY[c]);
    this.code = c;
    this.status = ERROR_STATUS[c];
    this.messageKey = messageKey || DEFAULT_MESSAGE_KEY[c];
    this.details = details;
  }
}
