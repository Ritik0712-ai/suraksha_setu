import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { createMap, L, pinIcon } from "./leaflet.js";

/**
 * One location with its accuracy circle and an optional trail (SOS active, tracking page,
 * complaint detail, portal). Follows `center` as new positions arrive.
 */
export default function LeafletMapView({ center, accuracyM, approximate, trail = [] }) {
  const { t } = useTranslation();
  const el = useRef(null);
  const map = useRef(null);
  const layers = useRef(null);

  useEffect(() => {
    map.current = createMap(el.current, { center, zoom: approximate ? 14 : 16, t });
    layers.current = L.layerGroup().addTo(map.current);
    return () => map.current.remove();
    // Create once; position updates are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const trailKey = trail.map((p) => `${p.lat},${p.lng}`).join("|");
  useEffect(() => {
    const g = layers.current;
    if (!g) return;
    g.clearLayers();
    const radius = approximate ? Math.max(300, accuracyM ?? 0) : accuracyM;
    if (radius)
      L.circle(center, {
        radius,
        color: "#C62828",
        opacity: 0.6,
        weight: 2,
        fillColor: "#C62828",
        fillOpacity: 0.12,
        interactive: false,
      }).addTo(g);
    if (trail.length > 1)
      L.polyline(trail, { color: "#003366", weight: 3, opacity: 0.8, interactive: false }).addTo(g);
    L.marker(center, {
      icon: pinIcon(),
      keyboard: false,
      alt: t("common:map.pin"),
      interactive: false,
    }).addTo(g);
    map.current.panTo(center);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center.lat, center.lng, accuracyM, approximate, trailKey]);

  return <div ref={el} style={{ width: "100%", height: "100%" }} />;
}
