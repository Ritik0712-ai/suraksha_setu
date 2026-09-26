import { Box, ButtonBase, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

const TINTS = {
  navy: { bg: "#E8EEF6", fg: "#003366" },
  saffron: { bg: "#FFF4E5", fg: "#C2410C" },
  red: { bg: "#FDECEC", fg: "#C62828" },
};

/** Home module tile (docs/04 §5.3): square, 48 px icon in a 72 px tinted circle, label below. */
export function ModuleTile({ to, icon: Icon, label, tint = "navy", onClick }) {
  const c = TINTS[tint];
  return (
    <ButtonBase
      component={to ? RouterLink : "button"}
      to={to}
      onClick={onClick}
      focusRipple
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 1.5,
        p: 2,
        // Square on phones (docs/04 §5.3); a fixed height on wide screens avoids huge tiles.
        aspectRatio: { xs: "1 / 1", md: "auto" },
        minHeight: { xs: 150, md: 184 },
        width: "100%",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: "16px",
        bgcolor: "background.paper",
        textAlign: "center",
        "&:active": { bgcolor: "primary.light" },
        "&.Mui-focusVisible": { outline: "3px solid", outlineColor: "secondary.main" },
      }}
    >
      <Box
        sx={{
          width: 72,
          height: 72,
          borderRadius: "50%",
          bgcolor: c.bg,
          color: c.fg,
          display: "grid",
          placeItems: "center",
        }}
      >
        <Icon sx={{ fontSize: 48 }} />
      </Box>
      <Typography component="span" variant="h3" color="text.primary" sx={{ lineHeight: 1.35 }}>
        {label}
      </Typography>
    </ButtonBase>
  );
}
