import { Box, Button, Paper, Stack, Typography } from "@mui/material";
import {
  AssignmentRounded,
  BloodtypeRounded,
  CallRounded,
  FactCheckRounded,
  LocalHospitalRounded,
  PhotoCameraRounded,
  VolunteerActivismRounded,
} from "@mui/icons-material";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSession } from "../../stores/session.js";
import { SahayakIcon } from "../../components/icons/index.jsx";
import { ModuleTile } from "../../components/ui/ModuleTile.jsx";
import { Notice } from "../../components/ui/Notice.jsx";

// Tiles in docs/03 S-02 order. `login: true` tiles send guests to /login?next=.
const GUEST_TILES = [
  { to: "/complaints/new", key: "modules.report", icon: PhotoCameraRounded, login: true },
  { to: "/schemes", key: "modules.schemes", icon: VolunteerActivismRounded, tint: "saffron" },
  { to: "/schemes/check", key: "modules.check", icon: FactCheckRounded, tint: "saffron" },
  { to: "/emergency", key: "modules.emergency", icon: LocalHospitalRounded },
  { to: "/blood", key: "modules.blood", icon: BloodtypeRounded, tint: "red", login: true },
  { to: "/sahayak", key: "modules.sahayak", icon: SahayakIcon, login: true },
  { to: "/fake-call", key: "modules.fakeCall", icon: CallRounded },
];

// Logged in: "My complaints" takes the eligibility tile's place, which moves after Schemes.
const CITIZEN_TILES = [
  GUEST_TILES[0],
  { to: "/complaints", key: "modules.myComplaints", icon: AssignmentRounded },
  GUEST_TILES[1],
  GUEST_TILES[2],
  GUEST_TILES[3],
  GUEST_TILES[4],
  GUEST_TILES[5],
  GUEST_TILES[6],
];

/** Big red SOS card — the most prominent element above the fold (docs/04 §5.3). */
function SosCard() {
  const { t } = useTranslation("home");
  return (
    <Box
      component={RouterLink}
      to="/sos"
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        minHeight: 120,
        p: 2,
        borderRadius: 2,
        bgcolor: "error.main",
        color: "#fff",
        textDecoration: "none",
        "&:focus-visible": { outline: "3px solid #C2410C", outlineOffset: 3 },
      }}
    >
      <Box
        aria-hidden
        sx={{
          width: 88,
          height: 88,
          flexShrink: 0,
          borderRadius: "50%",
          border: "4px solid #fff",
          display: "grid",
          placeItems: "center",
          fontWeight: 700,
          fontSize: "1.5rem",
        }}
      >
        SOS
      </Box>
      <Box>
        <Typography variant="h2" component="h2">
          {t("sosCard.title")}
        </Typography>
        <Typography sx={{ fontWeight: 500 }}>{t("sosCard.button")}</Typography>
        <Typography variant="body2" sx={{ opacity: 0.95 }}>
          {t("sosCard.hint")}
        </Typography>
      </Box>
    </Box>
  );
}

/** S-02 Home (docs/03): different content for guests and logged-in citizens. */
export default function HomePage() {
  const { t } = useTranslation("home");
  const navigate = useNavigate();
  const status = useSession((s) => s.status);
  const user = useSession((s) => s.user);
  const authed = status === "authed";
  const tiles = authed ? CITIZEN_TILES : GUEST_TILES;
  const firstName = user?.name?.split(/\s+/)[0];

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h2" component="h1">
          {authed ? t("greetingName", { name: firstName }) : t("greeting")}
        </Typography>
        <Typography color="text.secondary">{t("tagline", { ns: "common" })}</Typography>
      </Box>

      {authed && user?.emergencyContactCount === 0 && (
        <Notice
          kind="warning"
          title={t("setup.title")}
          action={
            <Button variant="contained" component={RouterLink} to="/profile/contacts">
              {t("setup.button")}
            </Button>
          }
        />
      )}

      <SosCard />

      <Box component="section" aria-labelledby="services-heading">
        <Typography id="services-heading" variant="h2" sx={{ mb: 2 }} className="visually-hidden">
          {t("services")}
        </Typography>
        <Box
          component="ul"
          sx={{
            listStyle: "none",
            p: 0,
            m: 0,
            display: "grid",
            gap: 2,
            gridTemplateColumns: {
              xs: "repeat(2, 1fr)",
              sm: "repeat(3, 1fr)",
              md: "repeat(4, 1fr)",
            },
          }}
        >
          {tiles.map((tile) => (
            <li key={tile.to}>
              <ModuleTile
                icon={tile.icon}
                tint={tile.tint}
                label={t(tile.key, { ns: "common" })}
                {...(tile.login && !authed
                  ? { onClick: () => navigate(`/login?next=${encodeURIComponent(tile.to)}`) }
                  : { to: tile.to })}
              />
            </li>
          ))}
        </Box>
      </Box>

      {!authed && status !== "loading" && (
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
          <Typography sx={{ mb: 2 }}>{t("account.text")}</Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <Button variant="contained" component={RouterLink} to="/register">
              {t("actions.register", { ns: "common" })}
            </Button>
            <Button variant="text" component={RouterLink} to="/login">
              {t("actions.logIn", { ns: "common" })}
            </Button>
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}
