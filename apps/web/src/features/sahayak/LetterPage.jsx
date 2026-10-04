import { useState } from "react";
import {
  Box,
  Button,
  GlobalStyles,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  ArrowBackRounded,
  ContentCopyRounded,
  EditRounded,
  PrintRounded,
  WhatsApp,
  DescriptionRounded,
} from "@mui/icons-material";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link as RouterLink, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { apiError } from "../../api/client.js";
import { chatApi } from "../../api/endpoints.js";
import { copyText, whatsappHref } from "../../lib/device.js";
import { ListenButton } from "../../components/ui/Speech.jsx";
import { toast } from "../../stores/toast.js";
import { EmptyState, ErrorCard, ListSkeleton } from "../../components/ui/States.jsx";
import { SubmitButton } from "../../components/ui/fields.jsx";
import { letterLanguage, letterText, recipientLines } from "./letter.js";

// Print only the letter: A4, 2 cm margins, black text, no app chrome (docs/03 S-26, docs/04 §6.9).
const printCss = (
  <GlobalStyles
    styles={{
      "@media print": {
        "@page": { size: "A4", margin: "2cm" },
        "body *": { visibility: "hidden" },
        "#letter-sheet, #letter-sheet *": { visibility: "visible", color: "#000 !important" },
        "#letter-sheet": {
          position: "absolute",
          inset: "0 auto auto 0",
          width: "100%",
          border: "none !important",
          boxShadow: "none !important",
          padding: "0 !important",
        },
      },
    }}
  />
);

function Sheet({ letter }) {
  const { t } = useTranslation("sahayak");
  const lng = letterLanguage(letter);
  const f = (k) => t(`letter.format.${k}`, { lng });
  return (
    <Paper
      id="letter-sheet"
      lang={lng}
      variant="outlined"
      sx={{ p: 3, boxShadow: "0 2px 8px rgba(0, 38, 77, 0.08)", "& p": { lineHeight: 1.7 } }}
    >
      <Typography>{f("to")}</Typography>
      {recipientLines(letter.to).map((l) => (
        <Typography key={l} sx={{ pl: 2 }}>
          {l}
        </Typography>
      ))}
      <Typography sx={{ mt: 2, fontWeight: 700 }}>
        {f("subject")} {letter.subject}
      </Typography>
      <Typography sx={{ mt: 2 }}>{f("salutation")}</Typography>
      <Typography sx={{ mt: 1, whiteSpace: "pre-line", textAlign: "justify" }}>
        {letter.body}
      </Typography>
      <Typography sx={{ mt: 2 }}>{f("thanks")}</Typography>
      <Box sx={{ mt: 2, ml: "auto", width: "fit-content", maxWidth: "100%" }}>
        <Typography>{f("applicant")}</Typography>
        <Typography sx={{ fontWeight: 500 }}>{letter.applicantName}</Typography>
        {letter.place && <Typography>{letter.place}</Typography>}
        {letter.mobile && (
          <Typography>
            {f("mobile")} {letter.mobile}
          </Typography>
        )}
      </Box>
      {letter.date && (
        <Typography sx={{ mt: 2 }}>
          {f("date")} {letter.date}
        </Typography>
      )}
    </Paper>
  );
}

function EditForm({ letter, onCancel, onSave }) {
  const { t } = useTranslation("sahayak");
  const [v, setV] = useState({
    to: letter.to,
    subject: letter.subject,
    body: letter.body,
    applicantName: letter.applicantName,
  });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setV((x) => ({ ...x, [k]: e.target.value }));
  const valid = Object.values(v).every((x) => x.trim());
  return (
    <Stack
      component="form"
      spacing={2}
      onSubmit={async (e) => {
        e.preventDefault();
        if (!valid) return;
        setBusy(true);
        const ok = await onSave(v);
        if (!ok) setBusy(false);
      }}
    >
      <TextField label={t("letter.fields.to")} value={v.to} onChange={set("to")} multiline />
      <TextField label={t("letter.fields.subject")} value={v.subject} onChange={set("subject")} />
      <TextField
        label={t("letter.fields.body")}
        value={v.body}
        onChange={set("body")}
        multiline
        minRows={6}
      />
      <TextField
        label={t("letter.fields.applicantName")}
        value={v.applicantName}
        onChange={set("applicantName")}
      />
      <SubmitButton busy={busy} disabled={!valid}>
        {t("letter.doneEditing")}
      </SubmitButton>
      <Button onClick={onCancel} disabled={busy}>
        {t("letter.cancelEdit")}
      </Button>
    </Stack>
  );
}

/** S-26 Letter preview (docs/03): paper-like card, edit, copy, WhatsApp, print. */
export default function LetterPage() {
  const { t } = useTranslation("sahayak");
  const { sessionId, messageId } = useParams();
  const qc = useQueryClient();
  const key = ["chat", sessionId];
  const q = useQuery({
    queryKey: key,
    queryFn: () => chatApi.get(sessionId),
    retry: (n, err) => apiError(err).status !== 404 && n < 2,
  });
  const [editing, setEditing] = useState(false);

  const message = q.data?.messages?.find((m) => m.id === messageId);
  const letter = message?.letterEdited ?? message?.letter;
  const back = (
    <IconButton component={RouterLink} to={`/sahayak/${sessionId}`} aria-label={t("chat.back")}>
      <ArrowBackRounded />
    </IconButton>
  );

  if (q.isLoading) return <ListSkeleton onRetry={() => q.refetch()} />;
  if (q.isError && apiError(q.error).status !== 404)
    return <ErrorCard network={apiError(q.error).network} onRetry={() => q.refetch()} />;
  if (!letter)
    return (
      <EmptyState
        icon={DescriptionRounded}
        title={t("letter.notFound")}
        action={
          <Button variant="contained" component={RouterLink} to="/sahayak">
            {t("chat.back")}
          </Button>
        }
      />
    );

  const save = async (edited) => {
    try {
      const updated = await chatApi.saveLetter(sessionId, messageId, {
        ...edited,
        place: letter.place ?? "",
        date: letter.date ?? "",
        mobile: letter.mobile ?? "",
      });
      qc.setQueryData(key, (old) => ({
        ...old,
        messages: old.messages.map((m) => (m.id === messageId ? { ...m, ...updated } : m)),
      }));
      toast(t("letter.saved"));
      setEditing(false);
      return true;
    } catch (err) {
      toast(apiError(err).message ?? t("states.serverError", { ns: "common" }), "error");
      return false;
    }
  };

  const text = letterText(letter);
  const shareText = `${text}\n\n— ${t("letter.footer")}`;

  return (
    <Stack spacing={2} sx={{ maxWidth: 760, mx: "auto", pb: 12 }}>
      {printCss}
      <Stack direction="row" spacing={1} alignItems="center">
        {back}
        <Typography variant="h1" sx={{ fontSize: "1.375rem", flex: 1 }}>
          {t("letter.title")}
        </Typography>
        {!editing && <ListenButton text={text} />}
      </Stack>

      {editing ? (
        <EditForm letter={letter} onCancel={() => setEditing(false)} onSave={save} />
      ) : (
        <Sheet letter={letter} />
      )}

      <Typography variant="body2" color="text.secondary">
        {t("letter.footer")}
      </Typography>

      {!editing && (
        <Paper
          elevation={0}
          sx={{
            position: "sticky",
            bottom: { xs: "calc(80px + env(safe-area-inset-bottom))", md: 16 },
            p: 1,
            border: "1px solid",
            borderColor: "divider",
            display: "grid",
            gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(4, 1fr)" },
            gap: 1,
          }}
        >
          <Button variant="outlined" startIcon={<EditRounded />} onClick={() => setEditing(true)}>
            {t("letter.edit")}
          </Button>
          <Button
            variant="outlined"
            startIcon={<ContentCopyRounded />}
            onClick={async () => {
              if (await copyText(text)) toast(t("letter.copied"));
            }}
          >
            {t("letter.copy")}
          </Button>
          <Button
            variant="outlined"
            startIcon={<WhatsApp />}
            href={whatsappHref(shareText)}
            target="_blank"
            rel="noopener"
          >
            {t("letter.whatsapp")}
          </Button>
          <Button variant="contained" startIcon={<PrintRounded />} onClick={() => window.print()}>
            {t("letter.print")}
          </Button>
        </Paper>
      )}
    </Stack>
  );
}
