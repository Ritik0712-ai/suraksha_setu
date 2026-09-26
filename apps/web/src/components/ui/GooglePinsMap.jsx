import { useEffect } from "react";
import { APIProvider, Map, Marker, useMap } from "@vis.gl/react-google-maps";
import { useTranslation } from "react-i18next";

const STYLES = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

function FitBounds({ points }) {
  const map = useMap();
  const key = points.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join("|");
  useEffect(() => {
    if (!map || !window.google || points.length === 0) return;
    const bounds = new window.google.maps.LatLngBounds();
    points.forEach((p) => bounds.extend(p));
    if (points.length === 1) map.setCenter(points[0]);
    else map.fitBounds(bounds, 48);
    // Refit only when the set of positions changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key]);
  return null;
}

/**
 * Several pins + an optional "you are here" dot (docs/03 S-20 map view, A-04 live map). Loaded
 * lazily and only when a Maps key is configured.
 * @param pins [{ id, lat, lng, color?, label? }]
 */
export default function GooglePinsMap({ apiKey, pins, me, onPin, center }) {
  const { i18n } = useTranslation();
  const points = [...pins, ...(me ? [me] : [])];
  return (
    <APIProvider
      apiKey={apiKey}
      language={i18n.resolvedLanguage === "en" ? "en" : "hi"}
      region="IN"
    >
      <Map
        defaultCenter={center ?? points[0] ?? { lat: 23.2, lng: 77.08 }}
        defaultZoom={13}
        gestureHandling="greedy"
        disableDefaultUI
        zoomControl
        styles={STYLES}
        style={{ width: "100%", height: "100%" }}
      >
        {pins.map((p) => (
          <Marker
            key={p.id}
            position={p}
            title={p.label}
            onClick={() => onPin?.(p.id)}
            icon={
              p.color && window.google
                ? {
                    path: window.google.maps.SymbolPath.CIRCLE,
                    scale: 10,
                    fillColor: p.color,
                    fillOpacity: 1,
                    strokeColor: "#fff",
                    strokeWeight: 2,
                  }
                : undefined
            }
          />
        ))}
        {me && window.google && (
          <Marker
            position={me}
            icon={{
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: 7,
              fillColor: "#1565C0",
              fillOpacity: 1,
              strokeColor: "#fff",
              strokeWeight: 2,
            }}
          />
        )}
        <FitBounds points={points} />
      </Map>
    </APIProvider>
  );
}
