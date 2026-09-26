import { Box, ButtonBase, Chip, IconButton, Stack, Typography } from "@mui/material";
import { BookmarkBorderRounded, BookmarkRounded, ShieldRounded } from "@mui/icons-material";
import { Link as RouterLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLocalized } from "../../lib/localized.js";
import { CATEGORY_ICONS } from "./icons.js";

export function LevelBadge({ level }) {
  const { t } = useTranslation("schemes");
  return (
    <Chip
      size="small"
      label={t(`level.${level}`)}
      sx={{
        height: 24,
        fontWeight: 500,
        bgcolor: level === "state" ? "#FFF4E5" : "primary.light",
        color: level === "state" ? "#C2410C" : "primary.main",
      }}
    />
  );
}

/** Scheme card (docs/03 S-14): icon, name, one-line benefit, level badge, bookmark. */
export function SchemeCard({ scheme, saved, onToggleSave, footer }) {
  const { t } = useTranslation("schemes");
  const localized = useLocalized();
  const Icon = CATEGORY_ICONS[scheme.categories?.[0]] ?? ShieldRounded;
  const name = localized(scheme.name);
  return (
    <Box
      sx={{
        position: "relative",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        bgcolor: "background.paper",
      }}
    >
      <ButtonBase
        component={RouterLink}
        to={`/schemes/${scheme.slug}`}
        sx={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "flex-start",
          gap: 1.5,
          p: 2,
          pr: onToggleSave ? 7 : 2,
          width: "100%",
          textAlign: "left",
          borderRadius: 2,
          "&:focus-visible": { outline: "3px solid #C2410C", outlineOffset: 2 },
        }}
      >
        <Box
          sx={{
            width: 48,
            height: 48,
            flexShrink: 0,
            borderRadius: 1.5,
            bgcolor: "primary.light",
            color: "primary.main",
            display: "grid",
            placeItems: "center",
          }}
        >
          <Icon />
        </Box>
        <Stack spacing={0.5} sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700 }}>{name}</Typography>
          <Typography color="text.secondary">{localized(scheme.benefitShort)}</Typography>
          <Box>
            <LevelBadge level={scheme.level} />
          </Box>
        </Stack>
      </ButtonBase>
      {onToggleSave && (
        <IconButton
          onClick={() => onToggleSave(scheme.id)}
          aria-pressed={saved}
          aria-label={`${t(saved ? "saved" : "save")}: ${name}`}
          color="primary"
          sx={{ position: "absolute", top: 8, right: 8, width: 48, height: 48 }}
        >
          {saved ? <BookmarkRounded /> : <BookmarkBorderRounded />}
        </IconButton>
      )}
      {footer && <Box sx={{ px: 2, pb: 2 }}>{footer}</Box>}
    </Box>
  );
}
