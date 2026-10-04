import { useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Stack,
  Typography,
} from "@mui/material";
import {
  ArrowBackRounded,
  DeleteOutlineRounded,
  ForumRounded,
  MoreVertRounded,
  RefreshRounded,
} from "@mui/icons-material";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link as RouterLink, useLocation, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { isEmergencyMessage } from "@shared/emergencyCheck.js";
import C from "../../config/constants.js";
import { apiError } from "../../api/client.js";
import { chatApi } from "../../api/endpoints.js";
import { toast } from "../../stores/toast.js";
import { ConfirmDialog } from "../../components/ui/ResponsiveDialog.jsx";
import { EmptyState, ErrorCard, ListSkeleton } from "../../components/ui/States.jsx";
import { HelpfulVote } from "../../components/ui/HelpfulVote.jsx";
import { useMyFeedback } from "../../lib/feedback.js";
import {
  AssistantText,
  AssistantFooter,
  Bubble,
  ChatInput,
  EmergencyCard,
  LetterCard,
  MessageTime,
  QuickReplies,
  SchemeCards,
  Typing,
} from "./parts.jsx";

/** Why the last send failed: "failed" (retry), "resting" (AI down) or "limit" (30/day). */
function failureOf(err) {
  const x = apiError(err);
  if (x.status === 429) return "limit";
  if (x.status === 503 && x.details?.some?.((d) => d.issue === "resting")) return "resting";
  return "failed";
}

function BrowseSchemes() {
  const { t } = useTranslation("sahayak");
  return (
    <Button variant="outlined" size="small" component={RouterLink} to="/schemes" sx={{ mt: 1 }}>
      {t("chat.browseSchemes")}
    </Button>
  );
}

/** S-25 Chat (docs/03). */
export default function ChatPage() {
  const { t } = useTranslation("sahayak");
  const { sessionId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const key = ["chat", sessionId];
  const seeded = location.state?.session?.id === sessionId ? location.state.session : undefined;
  const q = useQuery({
    queryKey: key,
    queryFn: () => chatApi.get(sessionId),
    initialData: seeded,
    staleTime: seeded ? 30_000 : 0,
    retry: (n, err) => apiError(err).status !== 404 && n < 2,
  });
  const [pending, setPending] = useState(null); // { text, emergency, base }
  const [failure, setFailure] = useState(null); // { kind, text }
  const [menu, setMenu] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const endRef = useRef(null);
  const autoSent = useRef(false);

  // Wake the free AI service while the user reads and types (it sleeps when idle).
  useEffect(() => {
    chatApi.warmup();
  }, []);

  const send = async (text, { skip = false } = {}) => {
    setFailure(null);
    const base = qc.getQueryData(key)?.messages?.length ?? 0;
    setPending({ text, emergency: !skip && isEmergencyMessage(text, C.sahayak), base });
    try {
      const res = await chatApi.send(sessionId, { text, skipEmergencyCheck: skip });
      qc.setQueryData(key, (old) => ({
        ...(old ?? {}),
        ...res.session,
        messages: [...(old?.messages ?? []), res.userMessage, res.reply],
        remainingToday: res.remainingToday,
      }));
      qc.invalidateQueries({ queryKey: ["chat-sessions"] });
      // `pending` is cleared by the effect below once the reply is in the list, so the screen
      // never shows the local bubble and the server's copy together (or neither).
    } catch (err) {
      setFailure({ kind: failureOf(err), text });
      setPending(null);
    }
  };

  // A chip or typed question from S-24 arrives as router state and is sent once.
  useEffect(() => {
    const first = location.state?.send;
    if (first && !autoSent.current) {
      autoSent.current = true;
      navigate(location.pathname, { replace: true, state: { session: location.state.session } });
      send(first);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const messages = q.data?.messages ?? [];
  // 👍👎 under each real Sahayak answer (not the emergency card).
  const ratable = messages
    .filter((m) => m.role === "assistant" && m.intent !== "emergency")
    .map((m) => m.id);
  const votes = useMyFeedback("sahayak_reply", ratable);
  // The local bubble (and its instant emergency card) stays until the server's messages are in
  // the list; from that render on it is hidden, whichever state update React applies first.
  const waiting = pending && messages.length <= pending.base ? pending : null;
  useEffect(() => {
    if (pending && messages.length > pending.base) setPending(null);
  }, [pending, messages.length]);
  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: "end" });
  }, [messages.length, pending, failure]);

  if (q.isError && apiError(q.error).status === 404)
    return (
      <EmptyState
        icon={ForumRounded}
        title={t("chat.notFound")}
        action={
          <Button variant="contained" component={RouterLink} to="/sahayak">
            {t("chat.back")}
          </Button>
        }
      />
    );

  const remove = async () => {
    try {
      await chatApi.remove(sessionId);
      qc.removeQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ["chat-sessions"] });
      toast(t("chat.deleted"));
      navigate("/sahayak", { replace: true });
    } catch (err) {
      toast(apiError(err).message, "error");
    }
  };

  const last = messages.at(-1);
  const busy = Boolean(pending);
  const limitReached = failure?.kind === "limit";

  return (
    <Stack spacing={2} sx={{ maxWidth: 760, mx: "auto", minHeight: "60vh" }}>
      <Stack direction="row" spacing={1} alignItems="center">
        <IconButton component={RouterLink} to="/sahayak" aria-label={t("chat.back")}>
          <ArrowBackRounded />
        </IconButton>
        <Typography variant="h1" sx={{ flex: 1, fontSize: "1.375rem" }} noWrap>
          {q.data?.title ?? t("title")}
        </Typography>
        <IconButton
          aria-label={t("chat.menu")}
          aria-haspopup="menu"
          onClick={(e) => setMenu(e.currentTarget)}
          disabled={!q.data}
        >
          <MoreVertRounded />
        </IconButton>
        <Menu anchorEl={menu} open={Boolean(menu)} onClose={() => setMenu(null)}>
          <MenuItem
            onClick={() => {
              setMenu(null);
              setConfirmDelete(true);
            }}
          >
            <ListItemIcon>
              <DeleteOutlineRounded />
            </ListItemIcon>
            {t("chat.delete")}
          </MenuItem>
        </Menu>
      </Stack>

      {q.isLoading && <ListSkeleton onRetry={() => q.refetch()} />}
      {q.isError && <ErrorCard network={apiError(q.error).network} onRetry={() => q.refetch()} />}

      <Stack
        spacing={1.5}
        role="log"
        aria-live="polite"
        aria-label={t("chat.log")}
        sx={{ flex: 1 }}
      >
        {messages.map((m, i) => {
          if (m.role === "user")
            return (
              <Bubble key={m.id} mine label={t("chat.you")}>
                <Typography sx={{ whiteSpace: "pre-line", overflowWrap: "anywhere" }}>
                  {m.text}
                </Typography>
                <MessageTime at={m.createdAt} mine />
              </Bubble>
            );
          if (m.intent === "emergency") {
            const asked = messages[i - 1]?.role === "user" ? messages[i - 1].text : null;
            const isLast = i === messages.length - 1 && !waiting;
            return (
              <EmergencyCard
                key={m.id}
                onNotInDanger={isLast && asked ? () => send(asked, { skip: true }) : undefined}
              />
            );
          }
          return (
            <Bubble key={m.id} label={t("chat.sahayak")}>
              <AssistantText text={m.text} />
              <SchemeCards cards={m.cards} />
              {m.letter && <LetterCard sessionId={sessionId} message={m} />}
              {m.intent === "out_of_scope" && (
                <Typography variant="body2" sx={{ mt: 1 }} color="text.secondary">
                  {t("chat.outOfScope")}
                </Typography>
              )}
              <AssistantFooter message={m}>
                <HelpfulVote
                  target="sahayak_reply"
                  targetId={m.id}
                  ids={ratable}
                  value={votes.data?.[m.id]}
                  size="small"
                />
              </AssistantFooter>
            </Bubble>
          );
        })}
        {last?.role === "assistant" && !waiting && !failure && (
          <QuickReplies chips={last.chips} onPick={(c) => send(c)} disabled={busy} />
        )}

        {waiting && (
          <>
            <Bubble mine label={t("chat.you")}>
              <Typography sx={{ whiteSpace: "pre-line", overflowWrap: "anywhere" }}>
                {waiting.text}
              </Typography>
            </Bubble>
            {/* The emergency card shows at once from the local check, before the server answers. */}
            {waiting.emergency ? <EmergencyCard /> : <Typing />}
          </>
        )}

        {failure && (
          <>
            {failure.kind !== "limit" && (
              <Bubble mine label={t("chat.you")}>
                <Typography sx={{ whiteSpace: "pre-line" }}>{failure.text}</Typography>
              </Bubble>
            )}
            <Bubble label={t("chat.sahayak")}>
              {failure.kind === "failed" && (
                <>
                  <Typography>{t("chat.noReply")}</Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<RefreshRounded />}
                    onClick={() => send(failure.text)}
                    sx={{ mt: 1 }}
                  >
                    {t("actions.retry", { ns: "common" })}
                  </Button>
                </>
              )}
              {failure.kind === "resting" && (
                <>
                  <Typography>{t("chat.resting")}</Typography>
                  <BrowseSchemes />
                </>
              )}
              {failure.kind === "limit" && (
                <>
                  <Typography>{t("chat.limit")}</Typography>
                  <BrowseSchemes />
                </>
              )}
            </Bubble>
          </>
        )}
        <Box ref={endRef} />
      </Stack>

      <Box
        sx={{
          position: "sticky",
          bottom: { xs: "calc(80px + env(safe-area-inset-bottom))", md: 16 },
          bgcolor: "background.paper",
          pt: 1,
          zIndex: 1,
        }}
      >
        <ChatInput
          onSend={(text) => send(text)}
          disabled={busy || !q.data || limitReached || q.data?.remainingToday === 0}
          remaining={q.data?.remainingToday}
        />
      </Box>

      <ConfirmDialog
        open={confirmDelete}
        title={t("chat.deleteTitle")}
        body={t("chat.deleteBody")}
        confirmLabel={t("chat.delete")}
        cancelLabel={t("actions.cancel", { ns: "common" })}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          remove();
        }}
      />
    </Stack>
  );
}
