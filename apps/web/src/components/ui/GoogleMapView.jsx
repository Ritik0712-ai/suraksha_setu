import { useEffect } from "react";
import { APIProvider, Map, Marker, useMap } from "@vis.gl/react-google-maps";
import { useTranslation } from "react-i18next";

// Simplified map style: fewer points of interest, roads visible (docs/04 §6.7).
const STYLES = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

function Overlays({ center, accuracyM, approximate, trail }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !window.google) return undefined;
    const g = window.google.maps;
    const shapes = [];
    const radius = approximate ? Math.max(300, accuracyM ?? 0) : accuracyM;
    if (radius)
      shapes.push(
        new g.Circle({
          map,
          center,
          radius,
          strokeColor: "#C62828",
          strokeOpacity: 0.6,
          fillColor: "#C62828",
          fillOpacity: 0.12,
        }),
      );
    if (trail.length > 1)
      shapes.push(
        new g.Polyline({
          map,
          path: trail,
          strokeColor: "#003366",
          strokeWeight: 3,
          strokeOpacity: 0.8,
        }),
      );
    map.panTo(center);
    return () => shapes.forEach((s) => s.setMap(null));
  }, [map, center, accuracyM, approximate, trail]);
  return null;
}

export default function GoogleMapView({ apiKey, center, accuracyM, approximate, trail }) {
  const { i18n } = useTranslation();
  return (
    <APIProvider
      apiKey={apiKey}
      language={i18n.resolvedLanguage === "en" ? "en" : "hi"}
      region="IN"
    >
      <Map
        defaultCenter={center}
        defaultZoom={approximate ? 14 : 16}
        gestureHandling="greedy"
        disableDefaultUI
        zoomControl
        styles={STYLES}
        style={{ width: "100%", height: "100%" }}
      >
        <Marker position={center} />
        <Overlays center={center} accuracyM={accuracyM} approximate={approximate} trail={trail} />
      </Map>
    </APIProvider>
  );
}
