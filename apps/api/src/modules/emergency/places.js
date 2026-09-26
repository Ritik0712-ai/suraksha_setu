import { logger } from "../../lib/logger.js";
import { istDayStart } from "../../lib/time.js";

// Google Places API (New) Nearby Search — only when the curated directory has fewer than 3
// results (docs/02 ADR-09). Nothing from Places is stored: results go straight to the client
// (Google's terms allow keeping only place_id).
const TYPES = {
  hospital: ["hospital"],
  phc_chc: ["hospital"],
  police: ["police"],
  fire: ["fire_station"],
  pharmacy: ["pharmacy", "drugstore"],
};
const FIELDS = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.nationalPhoneNumber",
].join(",");

export const placesSupports = (type) => Boolean(TYPES[type]);

/**
 * Daily budget for billed Places calls (docs/02 §7.5, docs/06 task 5.2): a hard stop in code on
 * top of the quota and budget alert in Google Cloud Console. Resets at IST midnight.
 */
export function createPlacesBudget(limit, now = () => new Date()) {
  let day = null;
  let used = 0;
  const today = () => istDayStart(now()).getTime();
  return {
    take() {
      if (today() !== day) {
        day = today();
        used = 0;
      }
      if (used >= limit) return false;
      used += 1;
      return true;
    },
    get used() {
      return used;
    },
  };
}

/** → [{ placeId, name, address, lat, lng, phone }] or [] on any failure. */
export async function placesNearby({ key, fetchImpl = fetch, type, lat, lng, radiusM, lang }) {
  if (!key || !TYPES[type]) return [];
  try {
    const res = await fetchImpl("https://places.googleapis.com/v1/places:searchNearby", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": FIELDS,
      },
      body: JSON.stringify({
        includedTypes: TYPES[type],
        maxResultCount: 10,
        rankPreference: "DISTANCE",
        languageCode: lang,
        locationRestriction: {
          circle: { center: { latitude: lat, longitude: lng }, radius: Math.min(radiusM, 50000) },
        },
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      logger.warn({ status: res.status }, "Places search failed");
      return [];
    }
    const body = await res.json();
    return (body.places ?? [])
      .filter((p) => p.location)
      .map((p) => ({
        placeId: p.id,
        name: p.displayName?.text ?? "",
        address: p.formattedAddress ?? "",
        lat: p.location.latitude,
        lng: p.location.longitude,
        phone: p.nationalPhoneNumber ?? null,
      }));
  } catch (err) {
    logger.warn({ err: err?.message }, "Places search failed");
    return [];
  }
}
