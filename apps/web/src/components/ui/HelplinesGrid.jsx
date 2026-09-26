import { Box, ButtonBase, Typography } from "@mui/material";
import {
  ChildCareRounded,
  FireTruckRounded,
  LocalHospitalRounded,
  LocalPoliceRounded,
  SecurityRounded,
  WomanRounded,
} from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { EmergencyIcon } from "../icons/index.jsx";
import C from "../../config/constants.js";

const ICONS = {
  all_emergencies: EmergencyIcon,
  ambulance: LocalHospitalRounded,
  police: LocalPoliceRounded,
  fire: FireTruckRounded,
  women: WomanRounded,
  women_mp: WomanRounded,
  child: ChildCareRounded,
  cyber_fraud: SecurityRounded,
};

/**
 * National helplines from shared/constants.json — static, so it works offline (docs/01
 * FR-EMG-01). Tapping a card calls the number.
 */
export function HelplinesGrid({ onCall }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage === "en" ? "en" : "hi";
  return (
    <Box
      component="ul"
      sx={{
        listStyle: "none",
        p: 0,
        m: 0,
        display: "grid",
        gap: 1.5,
        gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(4, 1fr)" },
      }}
    >
      {C.helplines.map((h, i) => {
        const Icon = ICONS[h.key] ?? EmergencyIcon;
        const primary = i === 0;
        return (
          <li key={h.number}>
            <ButtonBase
              component="a"
              href={`tel:${h.number}`}
              onClick={() => onCall?.(h.number)}
              aria-label={`${h.name[lang]} — ${t("actions.call", { number: h.number })}`}
              focusRipple
              sx={{
                width: "100%",
                minHeight: 112,
                p: 1.5,
                gap: 0.5,
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                borderRadius: 2,
                border: "1px solid",
                borderColor: primary ? "error.main" : "divider",
                bgcolor: primary ? "error.main" : "background.paper",
                color: primary ? "#fff" : "text.primary",
                textAlign: "left",
              }}
            >
              <Icon sx={{ color: primary ? "#fff" : "error.main" }} />
              <Typography sx={{ fontSize: "1.5rem", fontWeight: 700, lineHeight: 1.2 }}>
                {h.number}
              </Typography>
              <Typography variant="body2" sx={{ lineHeight: 1.3 }}>
                {h.name[lang]}
              </Typography>
            </ButtonBase>
          </li>
        );
      })}
    </Box>
  );
}
