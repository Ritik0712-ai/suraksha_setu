import { useEffect, useRef, useState } from "react";
import { Box, Typography } from "@mui/material";
import { WifiOffRounded } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { selectOffline, useNetwork } from "../../stores/network.js";
import { toast } from "../../stores/toast.js";

/** X-03: yellow banner while offline; hides 2 s after reconnecting with a toast (docs/03 §2.5). */
export function OfflineBanner() {
  const { t } = useTranslation();
  const offline = useNetwork(selectOffline);
  const [visible, setVisible] = useState(offline);
  const wasOffline = useRef(offline);

  useEffect(() => {
    if (offline) {
      wasOffline.current = true;
      setVisible(true);
      return undefined;
    }
    if (!wasOffline.current) return undefined;
    const id = setTimeout(() => {
      setVisible(false);
      wasOffline.current = false;
      toast(t("offline.backOnline"));
    }, 2000);
    return () => clearTimeout(id);
  }, [offline, t]);

  if (!visible) return null;
  return (
    <Box
      role="status"
      aria-live="polite"
      sx={{
        display: "flex",
        gap: 1,
        alignItems: "center",
        px: 2,
        py: 1,
        bgcolor: "warning.light",
        color: "text.primary",
        borderBottom: "1px solid",
        borderColor: "warning.main",
      }}
    >
      <WifiOffRounded sx={{ color: "warning.main" }} />
      <Typography variant="body2">{t("offline.banner")}</Typography>
    </Box>
  );
}
