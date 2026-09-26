import { forwardRef, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  TextField,
} from "@mui/material";
import { VisibilityOffRounded, VisibilityRounded } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { cleanPhoneInput } from "../../lib/phone.js";

// Form fields (docs/04 §5.4): label above the field, helper below, errors with an icon and
// aria-describedby (TextField wires that up), the right mobile keyboard.

/** +91 mobile field: digits only, strips +91 / 0 / spaces as the user types (docs/03 S-03). */
export const PhoneField = forwardRef(function PhoneField({ onChange, value, ...props }, ref) {
  return (
    <TextField
      inputRef={ref}
      value={value ?? ""}
      onChange={(e) => onChange(cleanPhoneInput(e.target.value))}
      type="tel"
      autoComplete="tel-national"
      fullWidth
      inputProps={{ inputMode: "numeric", maxLength: 14 }}
      InputProps={{
        startAdornment: (
          <InputAdornment
            position="start"
            sx={{ "& p": { color: "text.primary", fontWeight: 500 } }}
          >
            +91
          </InputAdornment>
        ),
      }}
      {...props}
    />
  );
});

/** Password field with a show/hide eye button. */
export const PasswordField = forwardRef(function PasswordField(props, ref) {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);
  return (
    <TextField
      inputRef={ref}
      type={show ? "text" : "password"}
      fullWidth
      InputProps={{
        endAdornment: (
          <InputAdornment position="end">
            <IconButton
              onClick={() => setShow((s) => !s)}
              edge="end"
              aria-label={t(show ? "actions.hidePassword" : "actions.showPassword")}
              sx={{ width: 48, height: 48 }}
            >
              {show ? <VisibilityOffRounded /> : <VisibilityRounded />}
            </IconButton>
          </InputAdornment>
        ),
      }}
      {...props}
    />
  );
});

/** Button whose label becomes a same-width spinner while busy (docs/04 §6.1). */
export function SubmitButton({ busy, children, ...props }) {
  return (
    <Button type="submit" variant="contained" fullWidth disabled={busy} aria-busy={busy} {...props}>
      <Box component="span" sx={{ visibility: busy ? "hidden" : "visible" }}>
        {children}
      </Box>
      {busy && <CircularProgress size={24} color="inherit" sx={{ position: "absolute" }} />}
    </Button>
  );
}
