import { Box, Button, Container, Link, Paper, Stack, Typography } from "@mui/material";
import {
  CallRounded,
  HomeRounded,
  PersonRounded,
  VolunteerActivismRounded,
} from "@mui/icons-material";
import { Link as RouterLink, NavLink, Outlet, useLocation, useMatches } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { isSignedIn, useSession } from "../../stores/session.js";
import { LogoMark, SahayakIcon } from "../icons/index.jsx";
import { SessionExpiredDialog } from "../../features/system/SessionExpiredDialog.jsx";
import { MaintenanceGate } from "../../features/system/Maintenance.jsx";
import { useContactsCache } from "../../features/profile/useContactsCache.js";
import { Toaster } from "../ui/Toaster.jsx";
import {
  AccountMenu,
  LanguageToggle,
  NotificationBell,
  TextSizeControl,
} from "./HeaderControls.jsx";
import { OfflineBanner } from "./OfflineBanner.jsx";
import { OutboxRunner } from "./OutboxRunner.jsx";

export function SkipLink() {
  const { t } = useTranslation();
  return (
    <a className="skip-link" href="#main">
      {t("actions.skipToContent")}
    </a>
  );
}

export const TricolourStrip = () => (
  <Box
    aria-hidden
    sx={{
      height: 4,
      background: "linear-gradient(90deg,#FF6600 0 33.3%,#fff 33.3% 66.6%,#138808 66.6%)",
    }}
  />
);

/** Red "Emergency? Call 112" bar on every citizen screen (docs/01 FR-GEN-03, docs/03 §2.1). */
export function EmergencyBar() {
  const { t } = useTranslation();
  return (
    <Link
      href="tel:112"
      underline="none"
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 1,
        minHeight: 44,
        px: 2,
        bgcolor: "error.main",
        color: "#fff",
        fontWeight: 500,
        "&:focus-visible": { outline: "3px solid #fff", outlineOffset: -4 },
      }}
    >
      <CallRounded fontSize="small" aria-hidden />
      {t("emergencyBar")}
    </Link>
  );
}

export function Footer() {
  const { t } = useTranslation();
  return (
    <Box component="footer" sx={{ bgcolor: "primary.dark", color: "#fff", px: 2, py: 3, mt: 4 }}>
      <Container maxWidth="lg" disableGutters>
        <Typography variant="body2">{t("footer.disclaimer")}</Typography>
        <Box sx={{ display: "flex", gap: 3, mt: 1.5 }}>
          <Link component={RouterLink} to="/about" color="inherit" sx={{ py: 1 }}>
            {t("footer.about")}
          </Link>
          <Link component={RouterLink} to="/privacy" color="inherit" sx={{ py: 1 }}>
            {t("footer.privacy")}
          </Link>
        </Box>
      </Container>
    </Box>
  );
}

const DESKTOP_NAV = [
  { to: "/", key: "nav.home", end: true },
  { to: "/complaints", key: "nav.complaints" },
  { to: "/schemes", key: "nav.schemes" },
  { to: "/blood", key: "nav.blood" },
  { to: "/emergency", key: "nav.emergency" },
  { to: "/sahayak", key: "nav.sahayak" },
];

function Header({ authed, guest }) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  // Guests get Log in (and Register on wider screens) at the top of every page, except on the
  // login and register pages themselves.
  const showAuth = guest && !["/login", "/register"].includes(pathname);
  return (
    <Box
      component="header"
      sx={{ bgcolor: "background.paper", borderBottom: "1px solid", borderColor: "divider" }}
    >
      <Container
        maxWidth="lg"
        sx={{ display: "flex", alignItems: "center", gap: 1, minHeight: 56, px: { xs: 1, sm: 2 } }}
      >
        <Link
          component={RouterLink}
          to="/"
          underline="none"
          aria-label={t("header.home")}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            mr: "auto",
            minHeight: 48,
            pl: 1,
            minWidth: 0,
          }}
        >
          <LogoMark size={32} />
          <Typography
            component="span"
            variant="h3"
            color="primary"
            noWrap
            sx={{ fontWeight: 700, minWidth: 0 }}
          >
            {t("appName")}
          </Typography>
        </Link>
        <Box
          component="nav"
          aria-label={t("nav.main")}
          sx={{ display: { xs: "none", md: "flex" }, gap: 0.5, mr: 1 }}
        >
          {DESKTOP_NAV.map((n) => (
            <Button
              key={n.to}
              component={NavLink}
              to={n.to}
              end={n.end}
              sx={{
                color: "primary.main",
                borderRadius: 0,
                borderBottom: "3px solid transparent",
                "&.active": { fontWeight: 700, borderBottomColor: "#FF6600" },
              }}
            >
              {t(n.key)}
            </Button>
          ))}
          <Button
            component={RouterLink}
            to="/sos"
            variant="contained"
            color="error"
            sx={{ ml: 1, fontWeight: 700, px: 3 }}
          >
            SOS
          </Button>
        </Box>
        <LanguageToggle />
        <TextSizeControl />
        {authed && <NotificationBell />}
        {authed && <AccountMenu />}
        {showAuth && (
          <Stack direction="row" spacing={1} sx={{ ml: 0.5, flexShrink: 0 }}>
            <Button
              variant="outlined"
              size="small"
              component={RouterLink}
              to="/login"
              sx={{ minHeight: 40, whiteSpace: "nowrap" }}
            >
              {t("actions.logIn")}
            </Button>
            <Button
              variant="contained"
              size="small"
              component={RouterLink}
              to="/register"
              sx={{
                minHeight: 40,
                whiteSpace: "nowrap",
                display: { xs: "none", sm: "inline-flex" },
              }}
            >
              {t("actions.register")}
            </Button>
          </Stack>
        )}
      </Container>
    </Box>
  );
}

const BOTTOM_NAV = [
  { to: "/", key: "nav.home", Icon: HomeRounded, end: true },
  { to: "/schemes", key: "nav.schemes", Icon: VolunteerActivismRounded },
  { to: "/sos", key: "nav.sos", sos: true },
  { to: "/sahayak", key: "nav.sahayak", Icon: SahayakIcon },
  { to: "/profile", key: "nav.profile", Icon: PersonRounded },
];

/** Bottom navigation for logged-in citizens on mobile (docs/04 §6.4). SOS is a raised circle. */
function BottomNav() {
  const { t } = useTranslation();
  return (
    <Paper
      component="nav"
      aria-label={t("nav.main")}
      elevation={0}
      sx={{
        display: { xs: "block", md: "none" },
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: (theme) => theme.zIndex.appBar,
        borderTop: "1px solid",
        borderColor: "divider",
        boxShadow: "0 2px 8px rgba(0, 38, 77, 0.08)",
        pb: "env(safe-area-inset-bottom)",
      }}
    >
      <Box component="ul" sx={{ display: "flex", listStyle: "none", m: 0, p: 0, height: 64 }}>
        {BOTTOM_NAV.map((n) => (
          <Box component="li" key={n.to} sx={{ flex: 1, display: "flex" }}>
            {n.sos ? (
              <Box
                component={RouterLink}
                to={n.to}
                aria-label={t(n.key)}
                sx={{
                  mx: "auto",
                  mt: "-16px",
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  bgcolor: "error.main",
                  color: "#fff",
                  border: "4px solid #fff",
                  boxShadow: "0 0 0 4px rgba(198, 40, 40, 0.2)",
                  display: "grid",
                  placeItems: "center",
                  fontWeight: 700,
                  textDecoration: "none",
                  "&:focus-visible": { outline: "3px solid #C2410C", outlineOffset: 2 },
                }}
              >
                SOS
              </Box>
            ) : (
              <Box
                component={NavLink}
                to={n.to}
                end={n.end}
                sx={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 0.25,
                  color: "text.secondary",
                  textDecoration: "none",
                  borderTop: "3px solid transparent",
                  fontSize: "0.778rem",
                  fontWeight: 500,
                  "&.active": { color: "primary.main", borderTopColor: "primary.main" },
                  "&:focus-visible": { outline: "3px solid #C2410C", outlineOffset: -3 },
                }}
              >
                <n.Icon sx={{ fontSize: 28 }} aria-hidden />
                <span>{t(n.key)}</span>
              </Box>
            )}
          </Box>
        ))}
      </Box>
    </Paper>
  );
}

/**
 * Citizen app shell (docs/03 §2.1–2.2, docs/04 §5.2). Routes can set
 * `handle: { focus: true }` to hide the bottom nav, or `{ noEmergencyBar: true }` for screens
 * with their own call button (S-06, S-07, S-09).
 */
export function CitizenShell() {
  const matches = useMatches();
  const location = useLocation();
  const status = useSession((s) => s.status);
  const role = useSession((s) => s.user?.role);
  const handle = Object.assign({}, ...matches.map((m) => m.handle ?? {}));
  const authed = isSignedIn(status);
  const showBottomNav = authed && role === "citizen" && !handle.focus;
  useContactsCache();

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <SkipLink />
      <TricolourStrip />
      <Header authed={authed} guest={!authed && status !== "loading"} />
      {!handle.noEmergencyBar && <EmergencyBar />}
      <OfflineBanner />
      <OutboxRunner />
      <Box
        component="main"
        id="main"
        tabIndex={-1}
        sx={{ flex: 1, outline: "none", pb: showBottomNav ? "96px" : 0 }}
      >
        <Container maxWidth="lg" sx={{ py: 3, px: { xs: 2, sm: 3, md: 4 } }}>
          <MaintenanceGate>
            <Outlet key={location.pathname.split("/")[1]} />
          </MaintenanceGate>
        </Container>
        <Footer />
      </Box>
      {showBottomNav && <BottomNav />}
      <Toaster aboveBottomNav={showBottomNav} />
      <SessionExpiredDialog />
    </Box>
  );
}
