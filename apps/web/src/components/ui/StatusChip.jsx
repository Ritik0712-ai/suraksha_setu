import { Chip } from "@mui/material";
import {
  AssignmentIndRounded,
  BlockRounded,
  CheckCircleRounded,
  ConstructionRounded,
  SendRounded,
  VerifiedRounded,
  VerifiedUserRounded,
  VisibilityRounded,
} from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { EmergencyIcon } from "../icons/index.jsx";

// docs/04 §3.3 — status is always colour + icon + text, never colour alone.
const STYLES = {
  SUBMITTED: { bg: "#E8EEF6", fg: "#003366", Icon: SendRounded },
  VERIFIED: { bg: "#E8EEF6", fg: "#003366", Icon: VerifiedRounded },
  ASSIGNED: { bg: "#FFF4E5", fg: "#C2410C", Icon: AssignmentIndRounded },
  IN_PROGRESS: { bg: "#FFF8E1", fg: "#B45309", Icon: ConstructionRounded },
  RESOLVED: { bg: "#E6F4E6", fg: "#0B6E0B", Icon: CheckCircleRounded },
  REJECTED: { bg: "#F4F6FA", fg: "#4B5563", Icon: BlockRounded },
  SOS_ACTIVE: { bg: "#C62828", fg: "#FFFFFF", Icon: EmergencyIcon },
  SOS_ACKNOWLEDGED: { bg: "#FFF8E1", fg: "#B45309", Icon: VisibilityRounded },
  SOS_RESOLVED: { bg: "#E6F4E6", fg: "#0B6E0B", Icon: VerifiedUserRounded },
};

/** @param status complaint status, or SOS_ACTIVE / SOS_ACKNOWLEDGED / SOS_RESOLVED */
export function StatusChip({ status, size = "medium" }) {
  const { t } = useTranslation();
  const s = STYLES[status] ?? STYLES.SUBMITTED;
  return (
    <Chip
      icon={<s.Icon sx={{ color: `${s.fg} !important` }} />}
      label={t(`status.${status}`)}
      sx={{
        bgcolor: s.bg,
        color: s.fg,
        fontWeight: 500,
        height: size === "small" ? 32 : 40,
        "& .MuiChip-label": { whiteSpace: "nowrap" },
      }}
    />
  );
}
