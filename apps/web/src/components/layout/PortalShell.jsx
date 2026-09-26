import { useState } from "react";
import {
  AppBar,
  Badge,
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
} from "@mui/material";
import {
  AccountTreeRounded,
  AdminPanelSettingsRounded,
  AssignmentRounded,
  BarChartRounded,
  DashboardRounded,
  GroupRounded,
  HistoryRounded,
  LocalHospitalRounded,
  LogoutRounded,
  MenuRounded,
  PersonRounded,
  VolunteerActivismRounded,
} from "@mui/icons-material";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSession } from "../../stores/session.js";
import { useLogout } from "../../features/auth/useLogout.js";
import { ForceChangePassword } from "../../features/portal/ForceChangePassword.jsx";
import { SessionExpiredDialog } from "../../features/system/SessionExpiredDialog.jsx";
import { EmergencyIcon, LogoMark } from "../icons/index.jsx";
import { Toaster } from "../ui/Toaster.jsx";
import { LanguageToggle, NotificationBell } from "./HeaderControls.jsx";
import { OfflineBanner } from "./OfflineBanner.jsx";
import { SkipLink, TricolourStrip } from "./CitizenShell.jsx";

const FULL = 240;
const MINI = 72;

const MAIN = [
  { to: "/portal", key: "nav.overview", Icon: DashboardRounded, end: true },
  { to: "/portal/complaints", key: "nav.complaints", Icon: AssignmentRounded },
  { to: "/portal/sos", key: "nav.liveSos", Icon: EmergencyIcon, sos: true },
  { to: "/portal/analytics", key: "nav.analytics", Icon: BarChartRounded },
];
const ADMIN = [
  { to: "/portal/admin/users", key: "nav.users", Icon: GroupRounded },
  { to: "/portal/admin/schemes", key: "nav.schemes", Icon: VolunteerActivismRounded },
  {
    to: "/portal/admin/emergency-services",
    key: "nav.emergencyDirectory",
    Icon: LocalHospitalRounded,
  },
  { to: "/portal/admin/departments", key: "nav.departments", Icon: AdminPanelSettingsRounded },
  { to: "/portal/admin/jurisdictions", key: "nav.jurisdictions", Icon: AccountTreeRounded },
  { to: "/portal/admin/audit", key: "nav.audit", Icon: HistoryRounded },
];

function NavItem({ item, mini, activeSos, onNavigate }) {
  const { t } = useTranslation("portal");
  const label = t(item.key);
  const icon =
    item.sos && activeSos > 0 ? (
      <Badge badgeContent={activeSos} color="error">
        <item.Icon />
      </Badge>
    ) : (
      <item.Icon />
    );
  const button = (
    <ListItemButton
      component={NavLink}
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      aria-label={mini ? label : undefined}
      sx={{
        minHeight: 48,
        color: "#fff",
        borderLeft: "4px solid transparent",
        px: mini ? 2.5 : 2,
        "&.active": { bgcolor: "primary.main", borderLeftColor: "#FF6600" },
        "&:hover": { bgcolor: "rgba(255,255,255,0.08)" },
      }}
    >
      <ListItemIcon sx={{ color: "inherit", minWidth: mini ? 0 : 40 }}>{icon}</ListItemIcon>
      {!mini && <ListItemText primary={label} />}
    </ListItemButton>
  );
  return mini ? (
    <Tooltip title={label} placement="right">
      {button}
    </Tooltip>
  ) : (
    button
  );
}

function Sidebar({ mini, onNavigate }) {
  const { t } = useTranslation("portal");
  const user = useSession((s) => s.user);
  const logout = useLogout();
  const isAdmin = user?.role === "admin";
  return (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        bgcolor: "primary.dark",
        color: "#fff",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, p: 2, minHeight: 64 }}>
        {/* White badge so the navy shield stays visible on the navy sidebar. */}
        <Box sx={{ bgcolor: "#fff", borderRadius: 1.5, p: 0.5, display: "grid", flexShrink: 0 }}>
          <LogoMark size={28} />
        </Box>
        {!mini && (
          <Typography sx={{ fontWeight: 700, lineHeight: 1.2 }}>
            {t("appName", { ns: "common" })}
          </Typography>
        )}
      </Box>
      <List component="nav" aria-label={t("title")} sx={{ flex: 1, py: 0 }}>
        {MAIN.map((i) => (
          <NavItem key={i.to} item={i} mini={mini} activeSos={0} onNavigate={onNavigate} />
        ))}
        {isAdmin && (
          <>
            <Divider sx={{ borderColor: "rgba(255,255,255,0.2)", my: 1 }} />
            {!mini && (
              <ListSubheader
                disableSticky
                sx={{ bgcolor: "transparent", color: "rgba(255,255,255,0.75)", lineHeight: "36px" }}
              >
                {t("nav.admin")}
              </ListSubheader>
            )}
            {ADMIN.map((i) => (
              <NavItem key={i.to} item={i} mini={mini} activeSos={0} onNavigate={onNavigate} />
            ))}
          </>
        )}
      </List>
      <Divider sx={{ borderColor: "rgba(255,255,255,0.2)" }} />
      <List sx={{ py: 0 }}>
        <NavItem
          item={{ to: "/portal/profile", key: "nav.profile", Icon: PersonRounded }}
          mini={mini}
          onNavigate={onNavigate}
        />
        {!mini && user && (
          <Box sx={{ px: 2, py: 1 }}>
            <Typography sx={{ fontWeight: 500 }}>{user.name}</Typography>
            <Typography variant="body2" sx={{ opacity: 0.8 }}>
              {t(`roles.${user.role}`)}
            </Typography>
          </Box>
        )}
        <ListItemButton
          onClick={logout}
          aria-label={mini ? t("logout", { ns: "profile" }) : undefined}
          sx={{
            minHeight: 48,
            color: "#fff",
            px: mini ? 2.5 : 2,
            borderLeft: "4px solid transparent",
          }}
        >
          <ListItemIcon sx={{ color: "inherit", minWidth: mini ? 0 : 40 }}>
            <LogoutRounded />
          </ListItemIcon>
          {!mini && <ListItemText primary={t("logout", { ns: "profile" })} />}
        </ListItemButton>
      </List>
    </Box>
  );
}

/**
 * Authority/admin portal shell (docs/03 §2.6, docs/04 §7.1): full sidebar ≥ 1200 px, icon-only
 * sidebar 900–1199 px, hamburger drawer below 900 px.
 */
export function PortalShell({ title }) {
  const { t } = useTranslation("portal");
  const location = useLocation();
  const lg = useMediaQuery((theme) => theme.breakpoints.up("lg"));
  const md = useMediaQuery((theme) => theme.breakpoints.up("md"));
  const [open, setOpen] = useState(false);
  const width = lg ? FULL : md ? MINI : 0;

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <SkipLink />
      {md ? (
        <Drawer
          variant="permanent"
          PaperProps={{ sx: { width, border: 0, overflowX: "hidden" } }}
          sx={{ width, flexShrink: 0 }}
        >
          <Sidebar mini={!lg} />
        </Drawer>
      ) : (
        <Drawer
          open={open}
          onClose={() => setOpen(false)}
          PaperProps={{ sx: { width: FULL, border: 0 } }}
        >
          <Sidebar mini={false} onNavigate={() => setOpen(false)} />
        </Drawer>
      )}
      <Box
        sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", bgcolor: "#F4F6FA" }}
      >
        <TricolourStrip />
        <AppBar
          position="sticky"
          color="inherit"
          elevation={0}
          sx={{ borderBottom: "1px solid", borderColor: "divider" }}
        >
          <Toolbar sx={{ gap: 1 }}>
            {!md && (
              <IconButton
                edge="start"
                onClick={() => setOpen(true)}
                aria-label={t("openMenu")}
                sx={{ width: 48, height: 48 }}
              >
                <MenuRounded />
              </IconButton>
            )}
            <Typography variant="h3" component="p" sx={{ flex: 1 }} noWrap>
              {title ?? t("title")}
            </Typography>
            <LanguageToggle />
            <NotificationBell to="/portal/notifications" />
          </Toolbar>
        </AppBar>
        <OfflineBanner />
        <Box
          component="main"
          id="main"
          tabIndex={-1}
          sx={{ flex: 1, p: { xs: 2, md: 3 }, outline: "none" }}
        >
          <Outlet key={location.pathname} />
        </Box>
      </Box>
      <ForceChangePassword />
      <Toaster />
      <SessionExpiredDialog />
    </Box>
  );
}
