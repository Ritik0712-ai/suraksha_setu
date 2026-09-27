import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { createMap, L, pinIcon } from "./leaflet.js";

/** Map with one draggable pin; tapping the map moves it too (docs/03 S-10 step 3, admin forms). */
export default function LeafletPinPicker({ value, onChange }) {
  const { t } = useTranslation();
  const el = useRef(null);
  const map = useRef(null);
  const marker = useRef(null);
  const change = useRef(onChange);
  change.current = onChange;

  useEffect(() => {
    const m = createMap(el.current, { center: value, zoom: 17, t });
    const pin = L.marker(value, {
      icon: pinIcon(),
      draggable: true,
      autoPan: true,
      alt: t("common:map.pin"),
    }).addTo(m);
    pin.on("dragend", () => {
      const p = pin.getLatLng();
      change.current({ lat: p.lat, lng: p.lng });
    });
    m.on("click", (e) => change.current({ lat: e.latlng.lat, lng: e.latlng.lng }));
    map.current = m;
    marker.current = pin;
    return () => m.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!marker.current) return;
    const cur = marker.current.getLatLng();
    if (cur.lat === value.lat && cur.lng === value.lng) return;
    marker.current.setLatLng(value);
    map.current.panTo(value);
  }, [value.lat, value.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={el} style={{ width: "100%", height: "100%" }} />;
}
