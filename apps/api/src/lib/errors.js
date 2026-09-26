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

export class AppError extends Error {
  constructor(code, message, details) {
    super(message || code);
    this.code = code in ERROR_STATUS ? code : "INTERNAL";
    this.status = ERROR_STATUS[this.code];
    this.details = details;
  }
}
