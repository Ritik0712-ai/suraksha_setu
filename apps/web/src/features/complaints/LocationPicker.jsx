import { lazy, Suspense } from "react";
import { Box, Button, Stack, Typography } from "@mui/material";
import { MyLocationRounded } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { LocationCard } from "../../components/ui/MapView.jsx";
import { Notice } from "../../components/ui/Notice.jsx";

const LeafletPinPicker = lazy(() => import("../../components/ui/maps/LeafletPinPicker.jsx"));
const HEIGHT = 220; // docs/03 S-10 step 3

/**
 * S-10 step 3 location. Online: a map with a draggable pin (OpenStreetMap, free). Offline: a
 * location card with the coordinates. With no location at all, the home village is used server-side.
 */
export function LocationPicker({ value, source, locating, onChange, onLocate }) {
  const { t } = useTranslation("complaints");
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  const useMap = Boolean(!offline && value);

  return (
    <Stack spacing={1.5}>
      {value && useMap && (
        <>
          <Box
            role="region"
            aria-label={t("details.mapCaption")}
            sx={{
              height: HEIGHT,
              borderRadius: 2,
              overflow: "hidden",
              border: "1px solid",
              borderColor: "divider",
              position: "relative",
              zIndex: 0,
            }}
          >
            <Suspense fallback={<LocationCard center={value} height={HEIGHT} showLink={false} />}>
              <LeafletPinPicker
                value={value}
                onChange={(p) => onChange({ lat: p.lat, lng: p.lng }, "pin")}
              />
            </Suspense>
          </Box>
          <Typography variant="body2" color="text.secondary">
            {t("details.mapCaption")}
          </Typography>
        </>
      )}
      {value && !useMap && (
        <LocationCard center={value} accuracyM={value.accuracyM} showLink={false} />
      )}
      {!value && !locating && source === "village" && (
        <Notice kind="warning">{t("details.villageFallback")}</Notice>
      )}
      {locating && (
        <Typography color="text.secondary" aria-live="polite">
          {t("details.locating")}
        </Typography>
      )}
      {value?.accuracyM && source === "gps" ? (
        <Typography variant="body2" color="text.secondary">
          {t("details.located", { m: value.accuracyM })}
        </Typography>
      ) : null}
      <Button
        variant="outlined"
        startIcon={<MyLocationRounded />}
        onClick={onLocate}
        disabled={locating}
      >
        {t("details.useMyLocation")}
      </Button>
    </Stack>
  );
}
