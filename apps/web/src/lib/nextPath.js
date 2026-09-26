/**
 * Only same-app relative paths are allowed as ?next= targets (no open redirects). Browsers treat
 * "/\evil.example" like "//evil.example", so backslashes and control characters are rejected too.
 */
export function safeNext(next, fallback = "/") {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//")) return fallback;
  const unsafeChar = (ch) => ch === "\\" || ch.charCodeAt(0) < 32 || ch.charCodeAt(0) === 127;
  if ([...next].some(unsafeChar)) return fallback;
  if (next.startsWith("/login") || next.startsWith("/register")) return fallback;
  return next;
}
