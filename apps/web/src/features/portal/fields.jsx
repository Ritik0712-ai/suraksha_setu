import { lazy, Suspense } from "react";
import { Box, Stack, TextField, Typography } from "@mui/material";

const KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY;
const GooglePinPicker = lazy(() => import("../../components/ui/GooglePinPicker.jsx"));

/** Two-language inputs used by the admin forms. */
export function BiField({ label, value, onChange, id }) {
  return (
    <Box>
      <Typography sx={{ fontWeight: 500, mb: 0.5 }}>{label}</Typography>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
        {["hi", "en"].map((lang) => (
          <TextField
            key={lang}
            id={`${id}-${lang}`}
            size="small"
            label={lang === "hi" ? "हिन्दी" : "English"}
            value={value?.[lang] ?? ""}
            onChange={(e) => onChange({ ...value, [lang]: e.target.value })}
            fullWidth
          />
        ))}
      </Stack>
    </Box>
  );
}

/** Latitude/longitude inputs, with a pin picker when a Maps key is configured. */
export function PointField({ value, onChange, latLabel, lngLabel, hint }) {
  return (
    <Stack spacing={1}>
      <Stack direction="row" spacing={1}>
        <TextField
          size="small"
          type="number"
          label={latLabel}
          value={value.lat}
          onChange={(e) => onChange({ ...value, lat: e.target.value })}
          inputProps={{ step: "0.00001" }}
          fullWidth
        />
        <TextField
          size="small"
          type="number"
          label={lngLabel}
          value={value.lng}
          onChange={(e) => onChange({ ...value, lng: e.target.value })}
          inputProps={{ step: "0.00001" }}
          fullWidth
        />
      </Stack>
      {KEY && Number(value.lat) && Number(value.lng) ? (
        <>
          <Box
            sx={{
              height: 220,
              borderRadius: 2,
              overflow: "hidden",
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <Suspense fallback={null}>
              <GooglePinPicker
                apiKey={KEY}
                value={{ lat: Number(value.lat), lng: Number(value.lng) }}
                onChange={(p) => onChange({ lat: p.lat.toFixed(6), lng: p.lng.toFixed(6) })}
              />
            </Suspense>
          </Box>
          <Typography variant="body2" color="text.secondary">
            {hint}
          </Typography>
        </>
      ) : null}
    </Stack>
  );
}
