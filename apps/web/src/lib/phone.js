// Same rules as the API (apps/api/src/lib/phone.js): strip spaces, +91, 91 or a leading 0.
const MOBILE = /^[6-9]\d{9}$/;

/** Returns the 10-digit national number, or null if it isn't a valid Indian mobile. */
export function toTenDigits(input) {
  let d = String(input ?? "").replace(/[\s\-().]/g, "");
  if (d.startsWith("+91")) d = d.slice(3);
  else if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  else if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return MOBILE.test(d) ? d : null;
}

/** Cleans what the user types into a phone field: digits only, max 10 (docs/03 S-03). */
export function cleanPhoneInput(input) {
  let d = String(input ?? "").replace(/\D/g, "");
  if (d.length > 10 && d.startsWith("91")) d = d.slice(2);
  if (d.length > 10 && d.startsWith("0")) d = d.slice(1);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return d.slice(0, 10);
}

/** "+919876543210" → "+91 98XXX XX210" (docs/03 S-27). */
export function maskPhone(e164) {
  if (!e164) return "";
  const d = e164.replace(/^\+91/, "");
  return `+91 ${d.slice(0, 2)}XXX XX${d.slice(7)}`;
}

/** "+919876543210" → "+91 98765 43210". */
export function formatPhone(e164) {
  if (!e164) return "";
  const d = e164.replace(/^\+91/, "");
  return `+91 ${d.slice(0, 5)} ${d.slice(5)}`;
}
