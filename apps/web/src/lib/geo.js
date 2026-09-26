// Location helpers for SOS and complaints (docs/03 S-06: high accuracy, 8 s timeout, fallbacks).

const LAST_KEY = "ss_last_location";

function remember(pos) {
  try {
    sessionStorage.setItem(LAST_KEY, JSON.stringify({ ...pos, at: Date.now() }));
  } catch {
    // ignore
  }
}

/** The last fix from this session (docs/03 S-06: "last known location from this session"). */
export function lastKnownLocation() {
  try {
    const v = JSON.parse(sessionStorage.getItem(LAST_KEY) ?? "null");
    return v && typeof v.lat === "number" ? v : null;
  } catch {
    return null;
  }
}

/**
 * One GPS fix. Resolves { lat, lng, accuracyM }, or rejects with { denied: true } when the user
 * has turned location off, or { unavailable: true } on timeout / no GPS.
 */
export function getPosition({ timeout = 8000, maximumAge = 0 } = {}) {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject({ unavailable: true });
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const pos = {
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          accuracyM: Math.round(p.coords.accuracy),
        };
        remember(pos);
        resolve(pos);
      },
      (err) => reject(err?.code === 1 ? { denied: true } : { unavailable: true }),
      { enableHighAccuracy: true, timeout, maximumAge },
    );
  });
}

export const mapsLink = ({ lat, lng }) =>
  `https://maps.google.com/?q=${lat.toFixed(6)},${lng.toFixed(6)}`;
export const directionsLink = ({ lat, lng }) =>
  `https://www.google.com/maps/dir/?api=1&destination=${lat.toFixed(6)},${lng.toFixed(6)}`;
