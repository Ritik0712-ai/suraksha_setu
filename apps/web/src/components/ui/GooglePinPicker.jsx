import { APIProvider, Map, Marker } from "@vis.gl/react-google-maps";
import { useTranslation } from "react-i18next";

const STYLES = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

/** Map with one draggable pin (docs/03 S-10 step 3). Loaded only when a Maps key is set. */
export default function GooglePinPicker({ apiKey, value, onChange }) {
  const { i18n } = useTranslation();
  return (
    <APIProvider
      apiKey={apiKey}
      language={i18n.resolvedLanguage === "en" ? "en" : "hi"}
      region="IN"
    >
      <Map
        center={value}
        defaultZoom={17}
        gestureHandling="greedy"
        disableDefaultUI
        zoomControl
        styles={STYLES}
        style={{ width: "100%", height: "100%" }}
        onClick={(e) => e.detail.latLng && onChange(e.detail.latLng)}
      >
        <Marker
          position={value}
          draggable
          onDragEnd={(e) => e.latLng && onChange({ lat: e.latLng.lat(), lng: e.latLng.lng() })}
        />
      </Map>
    </APIProvider>
  );
}
