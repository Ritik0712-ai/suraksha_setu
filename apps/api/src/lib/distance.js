const R = 6371000;
const rad = (d) => (d * Math.PI) / 180;

/** Great-circle distance in metres between { lat, lng } points. */
export function distanceM(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

export const toLatLng = (p) => (p ? { lat: p.coordinates[1], lng: p.coordinates[0] } : null);
export const toPoint = ({ lat, lng }) => ({ type: "Point", coordinates: [lng, lat] });
