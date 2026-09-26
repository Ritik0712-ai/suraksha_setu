import { useState } from "react";
import {
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  ArrowForwardRounded,
  CallRounded,
  DescriptionRounded,
  CrisisAlertRounded,
  SendRounded,
} from "@mui/icons-material";
import { Link as RouterLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import C from "../../config/constants.js";
import { useLocalized } from "../../lib/localized.js";
import { SahayakIcon } from "../../components/icons/index.jsx";
import { Markdown } from "./Markdown.jsx";

const MAX = C.sahayak.maxMessageChars;

/** Sahayak avatar — a diya, never a human face (docs/04 §6.8). */
export function SahayakAvatar({ size = 32 }) {
  return (
    <Avatar
      aria-hidden
      sx={{ width: size, height: size, bgcolor: "secondary.light", color: "secondary.main" }}
    >
      <SahayakIcon sx={{ fontSize: size * 0.7 }} />
    </Avatar>
  );
}

/** Chat bubbles (docs/04 §6.8): user right/navy, Sahayak left/grey with the avatar. */
export function Bubble({ mine, children, label }) {
  return (
    <Stack
      direction="row"
      spacing={1}
      justifyContent={mine ? "flex-end" : "flex-start"}
      alignItems="flex-end"
    >
      {!mine && <SahayakAvatar />}
      <Box
        aria-label={label}
        sx={{
          maxWidth: "85%",
          px: 2,
          py: 1.25,
          borderRadius: 4,
          ...(mine
            ? { bgcolor: "primary.main", color: "#fff", borderBottomRightRadius: 4 }
            : { bgcolor: "#F4F6FA", color: "text.primary", borderBottomLeftRadius: 4 }),
          "& a": mine ? { color: "#fff" } : undefined,
        }}
      >
        {children}
      </Box>
    </Stack>
  );
}

export function MessageTime({ at, mine }) {
  if (!at) return null;
  const time = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(at));
  return (
    <Typography
      variant="caption"
      sx={{ display: "block", mt: 0.5, opacity: 0.8, textAlign: mine ? "right" : "left" }}
    >
      {time}
    </Typography>
  );
}

/** Red SOS card shown for emergency words (docs/03 S-25, docs/04 §6.8 full SOS styling). */
export function EmergencyCard({ onNotInDanger }) {
  const { t } = useTranslation("sahayak");
  return (
    <Paper
      role="alert"
      elevation={0}
      sx={{ p: 2, bgcolor: "error.main", color: "#fff", borderRadius: 2 }}
    >
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1} alignItems="center">
          <CrisisAlertRounded />
          <Typography variant="h3" component="p" sx={{ color: "#fff" }}>
            {t("emergency.title")}
          </Typography>
        </Stack>
        <Typography>{t("emergency.body")}</Typography>
        <Button
          component={RouterLink}
          to="/sos"
          variant="contained"
          sx={{ bgcolor: "#fff", color: "error.main", "&:hover": { bgcolor: "#FDECEC" } }}
          startIcon={<CrisisAlertRounded />}
        >
          {t("emergency.sos")}
        </Button>
        <Button
          href="tel:112"
          variant="outlined"
          sx={{ color: "#fff", borderColor: "#fff", borderWidth: 2 }}
          startIcon={<CallRounded />}
        >
          {t("emergency.call112")}
        </Button>
        {onNotInDanger && (
          <Button onClick={onNotInDanger} sx={{ color: "#fff", textDecoration: "underline" }}>
            {t("emergency.notInDanger")}
          </Button>
        )}
      </Stack>
    </Paper>
  );
}

/** Compact scheme cards inside the thread (docs/03 S-25 "answer"). */
export function SchemeCards({ cards }) {
  const { t } = useTranslation("sahayak");
  const localized = useLocalized();
  if (!cards?.length) return null;
  return (
    <Stack spacing={1} sx={{ mt: 1.5 }}>
      {cards.map((c) => (
        <Paper key={c.slug} variant="outlined" sx={{ p: 1.5, bgcolor: "#fff" }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 500 }}>{localized(c.name)}</Typography>
              <Typography variant="body2" color="text.secondary">
                {localized(c.benefitShort)}
              </Typography>
            </Box>
            <Button
              size="small"
              component={RouterLink}
              to={`/schemes/${c.slug}`}
              endIcon={<ArrowForwardRounded />}
              aria-label={`${t("chat.viewScheme")}: ${localized(c.name)}`}
            >
              {t("chat.viewScheme")}
            </Button>
          </Stack>
        </Paper>
      ))}
    </Stack>
  );
}

/** "letter_ready" card: subject + first lines + View letter (docs/03 S-25). */
export function LetterCard({ sessionId, message }) {
  const { t } = useTranslation("sahayak");
  const letter = message.letterEdited ?? message.letter;
  if (!letter) return null;
  const preview = letter.body.split("\n").filter(Boolean).slice(0, 2).join(" ");
  return (
    <Paper variant="outlined" sx={{ mt: 1.5, p: 1.5, bgcolor: "#fff" }}>
      <Stack spacing={1}>
        <Stack direction="row" spacing={1} alignItems="center">
          <DescriptionRounded color="primary" />
          <Typography sx={{ fontWeight: 700 }}>{letter.subject}</Typography>
        </Stack>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {preview}
        </Typography>
        <Button
          variant="contained"
          component={RouterLink}
          to={`/sahayak/${sessionId}/letter/${message.id}`}
        >
          {t("chat.viewLetter")}
        </Button>
      </Stack>
    </Paper>
  );
}

export function QuickReplies({ chips, onPick, disabled }) {
  const { t } = useTranslation("sahayak");
  if (!chips?.length) return null;
  return (
    <Box
      role="group"
      aria-label={t("chat.quickReplies")}
      sx={{ display: "flex", flexWrap: "wrap", gap: 1, pl: 5 }}
    >
      {chips.map((c) => (
        <Chip
          key={c}
          label={c}
          variant="outlined"
          color="primary"
          disabled={disabled}
          onClick={() => onPick(c)}
          sx={{ height: "auto", minHeight: 40, "& .MuiChip-label": { whiteSpace: "normal" } }}
        />
      ))}
    </Box>
  );
}

export function Typing() {
  const { t } = useTranslation("sahayak");
  return (
    <Bubble>
      <Stack direction="row" spacing={1} alignItems="center">
        <CircularProgress size={16} />
        <Typography>{t("chat.typing")}</Typography>
      </Stack>
    </Bubble>
  );
}

export function AssistantText({ text }) {
  return <Markdown text={text} />;
}

/** Input bar: multiline field + send button; Enter sends, Shift+Enter adds a line. */
export function ChatInput({ onSend, disabled, remaining, initial = "", autoFocus = false }) {
  const { t } = useTranslation("sahayak");
  const [value, setValue] = useState(initial);
  const send = () => {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue("");
  };
  return (
    <Box>
      {remaining !== undefined && remaining <= 5 && (
        <Typography variant="body2" color="warning.main" sx={{ mb: 0.5 }} aria-live="polite">
          {t("input.left", { count: remaining })}
        </Typography>
      )}
      <Stack direction="row" spacing={1} alignItems="flex-end">
        <TextField
          fullWidth
          multiline
          maxRows={4}
          label={t("input.label")}
          value={value}
          autoFocus={autoFocus}
          disabled={disabled}
          onChange={(e) => setValue(e.target.value.slice(0, MAX))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          inputProps={{ maxLength: MAX }}
        />
        <IconButton
          aria-label={t("input.send")}
          onClick={send}
          disabled={disabled || !value.trim()}
          sx={{
            width: 56,
            height: 56,
            bgcolor: "primary.main",
            color: "#fff",
            "&:hover": { bgcolor: "primary.dark" },
            "&.Mui-disabled": { bgcolor: "action.disabledBackground" },
          }}
        >
          <SendRounded />
        </IconButton>
      </Stack>
    </Box>
  );
}
