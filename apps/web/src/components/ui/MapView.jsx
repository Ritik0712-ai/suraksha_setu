import { lazy, Suspense } from "react";
import { Box, Link, Stack, Typography } from "@mui/material";
import { LocationOnRounded } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { mapsLink } from "../../lib/geo.js";

const KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY;
// Google Maps loads only when a key is configured and a map is actually shown (docs/04 §6.7:
// lists first, maps are lazy). Without a key, or offline, the location card below is used.
const GoogleMapView = lazy(() => import("./GoogleMapView.jsx"));

/** Location card: works with no key, no network and on the cheapest phones. */
export function LocationCard({ center, accuracyM, approximate, height, showLink = true }) {
  const { t } = useTranslation("sos");
  return (
    <Stack
      spacing={1}
      justifyContent="center"
      sx={{
        minHeight: height,
        p: 2,
        borderRadius: 2,
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "#F4F6FA",
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center">
        <LocationOnRounded color={approximate ? "warning" : "error"} />
        <Typography sx={{ fontWeight: 500 }}>
          {approximate ? t("track.approximate") : t("map.noKey")}
        </Typography>
      </Stack>
      <Typography sx={{ fontFamily: "monospace" }}>
        {center.lat.toFixed(5)}, {center.lng.toFixed(5)}
      </Typography>
      {accuracyM ? (
        <Typography variant="body2" color="text.secondary">
          {t("map.accuracy", { m: accuracyM })}
        </Typography>
      ) : null}
      {showLink && (
        <Link
          href={mapsLink(center)}
          target="_blank"
          rel="noopener"
          sx={{ fontWeight: 500, py: 0.5 }}
        >
          {t("track.directions")}
        </Link>
      )}
    </Stack>
  );
}

/**
 * @param center     { lat, lng }
 * @param trail      [{ lat, lng }] oldest first (optional)
 * @param approximate draws a 300 m circle instead of trusting the pin (docs/03 S-30)
 */
export function MapView({
  center,
  accuracyM,
  approximate = false,
  trail = [],
  height = 220,
  showLink = true,
}) {
  const { t } = useTranslation("sos");
  if (!center) return null;
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  if (!KEY || offline)
    return (
      <LocationCard
        center={center}
        accuracyM={accuracyM}
        approximate={approximate}
        height={height}
        showLink={showLink}
      />
    );
  return (
    <Box
      role="region"
      aria-label={t("map.label")}
      sx={{
        height,
        borderRadius: 2,
        overflow: "hidden",
        border: "1px solid",
        borderColor: "divider",
      }}
    >
      <Suspense
        fallback={
          <LocationCard
            center={center}
            accuracyM={accuracyM}
            approximate={approximate}
            height={height}
          />
        }
      >
        <GoogleMapView
          apiKey={KEY}
          center={center}
          accuracyM={accuracyM}
          approximate={approximate}
          trail={trail}
        />
      </Suspense>
    </Box>
  );
}
