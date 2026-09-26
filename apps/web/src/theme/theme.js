import { createTheme } from "@mui/material/styles";

// MUI theme from docs/04 §11.2. Sizes stay in rem; only html { font-size } changes with the
// text-size control, so the theme never needs to be re-created (docs/04 §11.2 note).
export const theme = createTheme({
  palette: {
    primary: { main: "#003366", dark: "#00264D", light: "#E8EEF6", contrastText: "#FFFFFF" },
    secondary: { main: "#C2410C", light: "#FFF4E5", contrastText: "#FFFFFF" },
    error: { main: "#C62828", light: "#FDECEC", contrastText: "#FFFFFF" }, // SOS / emergency only
    success: { main: "#0B6E0B", light: "#E6F4E6", contrastText: "#FFFFFF" },
    warning: { main: "#B45309", light: "#FFF8E1", contrastText: "#FFFFFF" },
    info: { main: "#1565C0" },
    text: { primary: "#1A1A1A", secondary: "#4B5563" },
    divider: "#D0D7E2",
    background: { default: "#FFFFFF", paper: "#FFFFFF" },
  },
  typography: {
    fontFamily: '"Noto Sans", "Noto Sans Devanagari", system-ui, sans-serif',
    htmlFontSize: 18,
    fontSize: 18,
    h1: { fontSize: "1.556rem", lineHeight: 1.29, fontWeight: 700 }, // 28px
    h2: { fontSize: "1.333rem", lineHeight: 1.33, fontWeight: 700 }, // 24px
    h3: { fontSize: "1.111rem", lineHeight: 1.4, fontWeight: 500 }, // 20px
    body1: { fontSize: "1rem", lineHeight: 1.55 }, // 18px
    body2: { fontSize: "0.889rem", lineHeight: 1.5 }, // 16px
    caption: { fontSize: "0.778rem", lineHeight: 1.43, fontWeight: 500 }, // 14px
    button: { textTransform: "none", fontWeight: 500, fontSize: "1rem" },
  },
  shape: { borderRadius: 8 },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { minHeight: 56, paddingInline: 24 }, sizeSmall: { minHeight: 48 } },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { minHeight: 56 },
        notchedOutline: { borderColor: "#7A8699" },
      },
    },
    MuiChip: { styleOverrides: { root: { height: 40, borderRadius: 999 } } },
    MuiCard: { defaultProps: { variant: "outlined" } },
    MuiCssBaseline: {
      styleOverrides: {
        "*:focus-visible": { outline: "3px solid #C2410C", outlineOffset: 2 },
      },
    },
  },
});
