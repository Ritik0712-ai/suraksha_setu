import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { createMap, dotIcon, L, MAHODIYA, pinIcon } from "./leaflet.js";

/**
 * Several pins + an optional "you are here" dot (docs/03 S-20 map view, A-04 live map).
 * @param pins [{ id, lat, lng, color?, label? }]
 */
export default function LeafletPinsMap({ pins, me, onPin, center }) {
  const { t } = useTranslation();
  const el = useRef(null);
  const map = useRef(null);
  const layers = useRef(null);
  const tap = useRef(onPin);
  tap.current = onPin;

  useEffect(() => {
    map.current = createMap(el.current, {
      center: center ?? me ?? pins[0] ?? MAHODIYA,
      zoom: 13,
      t,
    });
    layers.current = L.layerGroup().addTo(map.current);
    return () => map.current.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const key =
    pins.map((p) => `${p.id}:${p.lat.toFixed(5)},${p.lng.toFixed(5)}:${p.color ?? ""}`).join("|") +
    (me ? `|me:${me.lat.toFixed(5)},${me.lng.toFixed(5)}` : "");
  useEffect(() => {
    const g = layers.current;
    if (!g) return;
    g.clearLayers();
    pins.forEach((p) => {
      const m = L.marker(p, {
        icon: p.color ? dotIcon(p.color, 18) : pinIcon(),
        title: p.label,
        alt: p.label ?? t("common:map.pin"),
        riseOnHover: true,
      }).addTo(g);
      m.on("click", () => tap.current?.(p.id));
      m.on("keypress", (e) => {
        if (e.originalEvent.key === "Enter") tap.current?.(p.id);
      });
    });
    if (me)
      L.marker(me, {
        icon: dotIcon("#1565C0", 14),
        alt: t("common:map.you"),
        keyboard: false,
        interactive: false,
      }).addTo(g);

    // Refit only when the set of positions changes, not on every render.
    const points = [...pins, ...(me ? [me] : [])];
    if (points.length === 1) map.current.setView(points[0], 15);
    else if (points.length > 1)
      map.current.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng])), {
        padding: [48, 48],
        maxZoom: 16,
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return <div ref={el} style={{ width: "100%", height: "100%" }} />;
}
