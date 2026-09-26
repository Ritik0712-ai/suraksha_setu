import { useState } from "react";
import {
  Badge,
  Button,
  IconButton,
  Popover,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { NotificationsRounded, TextFieldsRounded } from "@mui/icons-material";
import { Link as RouterLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { usersApi } from "../../api/endpoints.js";
import { usePrefs } from "../../stores/prefs.js";
import { useSession } from "../../stores/session.js";

/** Saves a preference to the profile in the background when logged in (docs/03 §2.3). */
function syncToProfile(patch) {
  if (useSession.getState().status !== "authed") return;
  usersApi.update(patch).catch(() => {});
}

/** "EN | हि" — switches instantly, no reload (docs/03 §2.3). Accessible name is bilingual. */
export function LanguageToggle({ color = "primary" }) {
  const { t, i18n } = useTranslation();
  const setLanguage = usePrefs((s) => s.setLanguage);
  const current = i18n.resolvedLanguage;
  const next = current === "hi" ? "en" : "hi";
  return (
    <Button
      size="small"
      color={color === "inherit" ? "inherit" : "primary"}
      aria-label={t("languageToggleLabel")}
      onClick={() => {
        i18n.changeLanguage(next);
        setLanguage(next);
        syncToProfile({ language: next });
      }}
      sx={{ minWidth: 0, px: 1, minHeight: 48, fontWeight: 700, whiteSpace: "nowrap" }}
    >
      <span lang="en" style={{ opacity: current === "en" ? 1 : 0.6 }}>
        EN
      </span>
      <span aria-hidden style={{ margin: "0 6px", opacity: 0.5 }}>
        |
      </span>
      <span lang="hi" style={{ opacity: current === "hi" ? 1 : 0.6 }}>
        हि
      </span>
    </Button>
  );
}

const SIZES = [
  { value: "sm", label: "A−", key: "header.sizeSm" },
  { value: "md", label: "A", key: "header.sizeMd" },
  { value: "lg", label: "A+", key: "header.sizeLg" },
];

/** "Aa" → popover with A− / A / A+ (docs/03 §2.4). Changes the root font size. */
export function TextSizeControl({ color = "primary" }) {
  const { t } = useTranslation();
  const [anchor, setAnchor] = useState(null);
  const textSize = usePrefs((s) => s.textSize);
  const setTextSize = usePrefs((s) => s.setTextSize);
  return (
    <>
      <IconButton
        color={color}
        aria-label={t("header.textSize")}
        aria-haspopup="true"
        aria-expanded={Boolean(anchor)}
        onClick={(e) => setAnchor(e.currentTarget)}
        sx={{ width: 48, height: 48 }}
      >
        <TextFieldsRounded />
      </IconButton>
      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Stack spacing={1} sx={{ p: 2 }}>
          <Typography variant="body2" id="text-size-label">
            {t("header.textSize")}
          </Typography>
          <ToggleButtonGroup
            exclusive
            value={textSize}
            aria-labelledby="text-size-label"
            onChange={(_e, v) => {
              if (!v) return;
              setTextSize(v);
              syncToProfile({ textSize: v });
            }}
          >
            {SIZES.map((s) => (
              <ToggleButton
                key={s.value}
                value={s.value}
                aria-label={t(s.key)}
                sx={{ minWidth: 56, minHeight: 48, fontWeight: 700, fontSize: "1rem" }}
              >
                {s.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Stack>
      </Popover>
    </>
  );
}

/** Notification bell (logged in only). The unread count arrives with task 4E.3. */
export function NotificationBell({ color = "primary", unread = 0 }) {
  const { t } = useTranslation();
  return (
    <IconButton
      component={RouterLink}
      to="/notifications"
      color={color}
      aria-label={t("header.notifications")}
      sx={{ width: 48, height: 48 }}
    >
      <Badge badgeContent={unread} color="error" max={99}>
        <NotificationsRounded />
      </Badge>
    </IconButton>
  );
}
