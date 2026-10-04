import { Button } from "@mui/material";
import { WhatsApp } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { whatsappHref } from "../../lib/device.js";

// WhatsApp's own colour, so people recognise the button at a glance.
const GREEN = "#1F8F4E";

/** Opens WhatsApp (app or web) with `text` ready to send to any chat. Free: just a link. */
export function WhatsAppShare({ text, size = "medium", fullWidth, sx }) {
  const { t } = useTranslation("common");
  if (!text) return null;
  return (
    <Button
      variant="outlined"
      size={size}
      fullWidth={fullWidth}
      startIcon={<WhatsApp />}
      href={whatsappHref(text)}
      target="_blank"
      rel="noopener"
      sx={{
        color: GREEN,
        borderColor: GREEN,
        "&:hover": { borderColor: GREEN, bgcolor: "rgba(31,143,78,0.06)" },
        ...sx,
      }}
    >
      {t("share.whatsapp")}
    </Button>
  );
}
