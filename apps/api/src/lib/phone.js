// Indian mobile numbers (docs/02 §6.1, docs/03 S-03): accept spaces, dashes, +91, 91 or a
// leading 0, and store E.164 (+91XXXXXXXXXX). Mobile numbers start with 6-9.
const MOBILE = /^[6-9]\d{9}$/;

/** Returns "+91XXXXXXXXXX", or null if the input isn't a valid Indian mobile number. */
export function normalizePhone(input) {
  if (typeof input !== "string" && typeof input !== "number") return null;
  let digits = String(input).replace(/[\s\-().]/g, "");
  if (digits.startsWith("+91")) digits = digits.slice(3);
  else if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return MOBILE.test(digits) ? `+91${digits}` : null;
}

/** "+919876543210" → "+91 98XXX XX210" (docs/03 S-27). */
export function maskPhone(e164) {
  if (!e164) return null;
  const d = e164.replace(/^\+91/, "");
  return `+91 ${d.slice(0, 2)}XXX XX${d.slice(7)}`;
}
