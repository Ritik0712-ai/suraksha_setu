import { apiError } from "../../api/client.js";
import { sosApi } from "../../api/endpoints.js";
import { getPosition, lastKnownLocation, mapsLink } from "../../lib/geo.js";
import { readJSON, STORAGE_KEYS } from "../../lib/storage.js";

const GPS_EXTRA_WAIT_MS = 3000;

/**
 * Picks the location to send (docs/03 S-06 step 1): the GPS fix (any accuracy — the server
 * labels > 100 m as approximate), else the last fix from this session, else the home village.
 * `gps` is the promise started when the countdown began; we wait at most 3 s more for it.
 */
export async function chooseLocation(gps) {
  let fix = null;
  let denied = false;
  try {
    fix = await Promise.race([
      gps,
      new Promise((_, rej) => setTimeout(() => rej({ timeout: true }), GPS_EXTRA_WAIT_MS)),
    ]);
  } catch (err) {
    denied = Boolean(err?.denied);
  }
  if (fix) return { payload: { ...fix, source: "gps" }, denied: false };
  const last = lastKnownLocation();
  if (last)
    return {
      payload: { lat: last.lat, lng: last.lng, accuracyM: last.accuracyM, source: "last_known" },
      denied,
    };
  return { payload: { source: "village" }, denied };
}

export const startGps = () => getPosition({ timeout: 8000, maximumAge: 0 });

/** Local SMS for when the API can't be reached (docs/03 S-06 step 4). */
export function offlineSms(t, name, payload) {
  const contacts = readJSON(STORAGE_KEYS.contacts, []) ?? [];
  const body =
    payload.lat !== undefined
      ? t("offlineSms", { name, link: mapsLink(payload) })
      : t("offlineSmsNoLocation", { name });
  return { recipients: contacts.map((c) => c.phone), body };
}

/**
 * POST /sos. Returns { ok: true, sos } or { ok: false, network } — a network failure means the
 * caller should switch to offline mode and keep retrying.
 */
export async function postSos(payload) {
  try {
    return { ok: true, sos: await sosApi.trigger(payload) };
  } catch (err) {
    const e = apiError(err);
    return { ok: false, network: e.network || e.status >= 500, error: e };
  }
}
