import { ButtonBase, Typography } from "@mui/material";

/**
 * Circular SOS button (docs/04 §6.1): sos-red, white label, 4 px white ring + soft red glow.
 * Red is reserved for emergencies — never use this style for anything else.
 */
export function SosButton({ size = 200, label = "SOS", sx, ...props }) {
  return (
    <ButtonBase
      focusRipple
      {...props}
      sx={{
        width: size,
        height: size,
        borderRadius: "50%",
        bgcolor: "error.main",
        color: "#fff",
        border: "4px solid #fff",
        boxShadow: "0 0 0 6px rgba(198, 40, 40, 0.25)",
        "&:hover": { bgcolor: "#B71C1C" },
        "&.Mui-focusVisible": {
          outline: "3px solid",
          outlineColor: "secondary.main",
          outlineOffset: 4,
        },
        ...sx,
      }}
    >
      <Typography
        component="span"
        sx={{ fontWeight: 700, fontSize: size >= 120 ? "2.2rem" : "1rem" }}
      >
        {label}
      </Typography>
    </ButtonBase>
  );
}
