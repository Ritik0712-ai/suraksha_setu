import { useState } from "react";
import {
  Box,
  Chip,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { ChevronRightRounded } from "@mui/icons-material";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { chatApi } from "../../api/endpoints.js";
import { formatDate } from "../../lib/time.js";
import { Notice } from "../../components/ui/Notice.jsx";
import { PageTitle } from "../../components/ui/PageTitle.jsx";
import { ChatInput, SahayakAvatar } from "./parts.jsx";

// Start chips (docs/03 S-24). Letter chips open a letter session; the emergency chip goes
// straight to the emergency screen without a chat.
const CHIPS = [
  { key: "schemes", ask: true },
  { key: "panchayat", letterType: "panchayat_complaint" },
  { key: "bdo", letterType: "bdo_application" },
  { key: "certificate", letterType: "certificate_application" },
  { key: "complaint", ask: true },
  { key: "emergency", to: "/emergency" },
];

/** S-24 Sahayak home (docs/03). */
export default function SahayakHomePage() {
  const { t } = useTranslation("sahayak");
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const recent = useQuery({ queryKey: ["chat-sessions"], queryFn: chatApi.sessions });

  const start = async (body, firstMessage) => {
    setBusy(true);
    setFailed(false);
    try {
      const s = await chatApi.start(body);
      navigate(`/sahayak/${s.id}`, {
        state: { session: s, ...(firstMessage ? { send: firstMessage } : {}) },
      });
    } catch {
      setFailed(true);
      setBusy(false);
    }
  };

  const onChip = (c) => {
    if (c.to) return navigate(c.to);
    if (c.letterType) return start({ mode: "letter", letterType: c.letterType });
    return start({ mode: "general" }, t(`home.chips.${c.key}`));
  };

  const sessions = (recent.data ?? []).slice(0, 5);

  return (
    <Stack spacing={3} sx={{ maxWidth: 760, mx: "auto" }}>
      <PageTitle sx={{ mb: 0 }}>{t("title")}</PageTitle>
      <Stack direction="row" spacing={2} alignItems="flex-start">
        <SahayakAvatar size={56} />
        <Paper elevation={0} sx={{ p: 2, bgcolor: "#F4F6FA", borderRadius: 4, flex: 1 }}>
          <Typography>{t("home.hello")}</Typography>
        </Paper>
      </Stack>

      <Box>
        <Typography component="h2" sx={{ fontWeight: 500, mb: 1 }}>
          {t("home.startLabel")}
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
          {CHIPS.map((c) => (
            <Chip
              key={c.key}
              label={t(`home.chips.${c.key}`)}
              onClick={() => onChip(c)}
              disabled={busy}
              color="primary"
              variant="outlined"
              sx={{
                height: "auto",
                minHeight: 48,
                fontSize: "1rem",
                "& .MuiChip-label": { whiteSpace: "normal", py: 1 },
              }}
            />
          ))}
        </Box>
      </Box>

      {failed && <Notice kind="error" title={t("home.startFailed")} />}

      <ChatInput
        disabled={busy}
        initial={params.get("q") ?? ""}
        onSend={(text) => start({ mode: "general" }, text)}
      />

      {sessions.length > 0 && (
        <Box component="section">
          <Typography variant="h2" sx={{ fontSize: "1.25rem", mb: 1 }}>
            {t("home.recent")}
          </Typography>
          <Paper variant="outlined">
            <List disablePadding>
              {sessions.map((s, i) => (
                <ListItemButton
                  key={s.id}
                  divider={i < sessions.length - 1}
                  onClick={() => navigate(`/sahayak/${s.id}`)}
                  sx={{ minHeight: 56 }}
                >
                  <ListItemText
                    primary={s.title}
                    secondary={formatDate(s.lastMessageAt)}
                    primaryTypographyProps={{ noWrap: true }}
                  />
                  <ChevronRightRounded color="action" />
                </ListItemButton>
              ))}
            </List>
          </Paper>
        </Box>
      )}

      <Typography variant="body2" color="text.secondary">
        {t("home.disclaimer")}
      </Typography>
    </Stack>
  );
}
