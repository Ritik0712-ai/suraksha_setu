// Free maps: Leaflet + OpenStreetMap tiles — no API key, no billing account (the project must
// cost nothing). OSM's tile policy (https://operations.osmfoundation.org/policies/tiles/) asks
// for visible attribution and a Referer header, both set here; our pilot traffic is tiny.
// This module is only imported by the lazily loaded map components, so Leaflet (~40 KB gzip)
// never lands in the first download.
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';

export const MAHODIYA = { lat: 23.2, lng: 77.08 };

/** A map in `el` with OSM tiles and translated zoom buttons. */
export function createMap(el, { center, zoom, t }) {
  const map = L.map(el, {
    center,
    zoom,
    zoomControl: false,
    attributionControl: true,
  });
  L.control
    .zoom({ zoomInTitle: t("common:map.zoomIn"), zoomOutTitle: t("common:map.zoomOut") })
    .addTo(map);
  map.attributionControl.setPrefix(false);
  L.tileLayer(TILE_URL, {
    maxZoom: 19,
    attribution: ATTRIBUTION,
    // The site sends strict-origin-when-cross-origin already; set it explicitly because OSM
    // blocks tile requests without a Referer.
    referrerPolicy: "strict-origin-when-cross-origin",
  }).addTo(map);
  return map;
}

/** Map pin as inline SVG (Leaflet's default marker images don't survive bundling). */
export function pinIcon(color = "#C62828") {
  return L.divIcon({
    className: "ss-pin",
    html: `<svg width="30" height="40" viewBox="0 0 30 40" aria-hidden="true"><path d="M15 1C7.3 1 1 7.2 1 14.9 1 25.3 15 39 15 39s14-13.7 14-24.1C29 7.2 22.7 1 15 1z" fill="${color}" stroke="#fff" stroke-width="2"/><circle cx="15" cy="15" r="5" fill="#fff"/></svg>`,
    iconSize: [30, 40],
    iconAnchor: [15, 39],
  });
}

/** Round dot, used for "you are here" and coloured status pins. */
export function dotIcon(color, size = 18) {
  return L.divIcon({
    className: "ss-pin",
    html: `<span style="display:block;width:${size}px;height:${size}px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.35)"></span>`,
    iconSize: [size + 6, size + 6],
    iconAnchor: [(size + 6) / 2, (size + 6) / 2],
  });
}

export { L };
