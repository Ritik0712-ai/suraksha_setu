import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Only the Latin and Devanagari subsets, weights 400/500/700 (docs/02 §3.1, docs/04 §4.1).
import "@fontsource/noto-sans/latin-400.css";
import "@fontsource/noto-sans/latin-500.css";
import "@fontsource/noto-sans/latin-700.css";
import "@fontsource/noto-sans-devanagari/devanagari-400.css";
import "@fontsource/noto-sans-devanagari/devanagari-500.css";
import "@fontsource/noto-sans-devanagari/devanagari-700.css";
import "./theme/tokens.css";
import "./i18n/index.js";
import App from "./App.jsx";
import { bootstrapSession } from "./features/auth/session.js";

// Restore the session from the refresh cookie while the shell renders (no splash screen).
bootstrapSession();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
