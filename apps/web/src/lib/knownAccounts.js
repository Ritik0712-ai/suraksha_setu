import { readJSON, writeJSON } from "./storage.js";
import { toTenDigits } from "./phone.js";

// "Who is using the phone?" — on a shared family phone, the people who logged in here are
// listed on the login screen so nobody has to remember a mobile number. Only the name and the
// number are kept (never a password or token), on this phone only, at most 5, and anyone can
// remove themselves from the list. Citizens only.

const KEY = "ss_known_accounts";
const MAX = 5;

export function knownAccounts() {
  const list = readJSON(KEY, []);
  return Array.isArray(list)
    ? list
        .filter((a) => toTenDigits(a?.phone) && typeof a?.name === "string")
        .sort((a, b) => (b.lastUsed ?? 0) - (a.lastUsed ?? 0))
    : [];
}

export function rememberAccount(user) {
  const phone = toTenDigits(user?.phone);
  if (!phone || user?.role !== "citizen") return;
  const rest = knownAccounts().filter((a) => a.phone !== phone);
  writeJSON(KEY, [{ phone, name: user.name, lastUsed: Date.now() }, ...rest].slice(0, MAX));
}

export function forgetAccount(phone) {
  const ten = toTenDigits(phone);
  writeJSON(
    KEY,
    knownAccounts().filter((a) => a.phone !== ten),
  );
}
