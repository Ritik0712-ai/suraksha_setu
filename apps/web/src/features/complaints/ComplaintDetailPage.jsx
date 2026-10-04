import { useState } from "react";
import {
  Box,
  Button,
  ButtonBase,
  Dialog,
  IconButton,
  Link,
  Paper,
  Stack,
  Step,
  StepContent,
  StepLabel,
  Stepper,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import {
  CloseRounded,
  ContentCopyRounded,
  SearchOffRounded,
  ShareRounded,
} from "@mui/icons-material";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link as RouterLink, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { apiError } from "../../api/client.js";
import { complaintsApi } from "../../api/endpoints.js";
import { copyText } from "../../lib/device.js";
import { ListenButton } from "../../components/ui/Speech.jsx";
import { WhatsAppShare } from "../../components/ui/WhatsAppShare.jsx";
import { mapsLink } from "../../lib/geo.js";
import { useSocketEvent } from "../../lib/socket.js";
import { formatDateTime } from "../../lib/time.js";
import { toast } from "../../stores/toast.js";
import { MapView } from "../../components/ui/MapView.jsx";
import { Notice } from "../../components/ui/Notice.jsx";
import { ResponsiveDialog } from "../../components/ui/ResponsiveDialog.jsx";
import { EmptyState, ErrorCard, ListSkeleton } from "../../components/ui/States.jsx";
import { StatusChip } from "../../components/ui/StatusChip.jsx";
import { SubmitButton } from "../../components/ui/fields.jsx";
import { buildSteps, useLocalized } from "./complaintUtils.js";

function Timeline({ complaint }) {
  const { t } = useTranslation("complaints");
  const { steps, active } = buildSteps(complaint);
  return (
    <Stepper orientation="vertical" activeStep={active} aria-label={t("detail.timeline")}>
      {steps.map((s, i) => {
        const done = i <= active;
        const rejected = s.status === "REJECTED";
        return (
          <Step key={s.status} completed={done && i < active} expanded={done}>
            <StepLabel
              error={rejected}
              optional={
                s.at && done ? (
                  <Typography variant="body2" color="text.secondary">
                    {formatDateTime(s.at)}
                  </Typography>
                ) : null
              }
            >
              <Typography sx={{ fontWeight: i === active ? 700 : 500 }}>
                {t(`status.${s.status}`, { ns: "common" })}
              </Typography>
            </StepLabel>
            <StepContent>
              {rejected && complaint.rejection && (
                <Typography color="error.main">
                  {t("detail.rejectedBecause", {
                    reason: complaint.rejection.text || t(`rejection.${complaint.rejection.code}`),
                  })}
                </Typography>
              )}
              {s.notes.map((n, k) => (
                <Box key={k} sx={{ mt: 0.5 }}>
                  <Typography variant="body2" color="text.secondary">
                    {t(`detail.events.${n.type}`)} · {formatDateTime(n.at)}
                  </Typography>
                  {n.text && <Typography sx={{ whiteSpace: "pre-wrap" }}>{n.text}</Typography>}
                </Box>
              ))}
            </StepContent>
          </Step>
        );
      })}
    </Stepper>
  );
}

function ReopenDialog({ open, complaintId, onClose }) {
  const { t } = useTranslation("complaints");
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (reason.trim().length < 10) return setError(t("detail.reopenHint"));
    setBusy(true);
    try {
      const updated = await complaintsApi.reopen(complaintId, { reason: reason.trim() });
      qc.setQueryData(["complaint", complaintId], updated);
      qc.invalidateQueries({ queryKey: ["complaints", "mine"] });
      toast(t("detail.reopened"));
      onClose();
    } catch (err) {
      const x = apiError(err);
      setError(x.network ? t("states.networkError", { ns: "common" }) : x.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ResponsiveDialog
      open={open}
      onClose={onClose}
      title={t("detail.reopenTitle")}
      labelId="reopen-title"
    >
      <Stack component="form" noValidate spacing={2.5} onSubmit={submit}>
        <TextField
          id="reopen-reason"
          label={t("detail.reopenReason")}
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            setError(null);
          }}
          inputProps={{ maxLength: 500 }}
          error={Boolean(error)}
          helperText={error || t("detail.reopenHint")}
          multiline
          minRows={3}
          fullWidth
          autoFocus
        />
        <Stack spacing={1}>
          <Button variant="outlined" onClick={onClose} disabled={busy}>
            {t("actions.cancel", { ns: "common" })}
          </Button>
          <SubmitButton busy={busy}>{t("detail.reopenSubmit")}</SubmitButton>
        </Stack>
      </Stack>
    </ResponsiveDialog>
  );
}

function DetailRow({ label, children }) {
  return (
    <Box sx={{ py: 1.5, borderBottom: "1px solid", borderColor: "divider" }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Box sx={{ mt: 0.5 }}>{children}</Box>
    </Box>
  );
}

/** S-13 Complaint detail (docs/03). */
export default function ComplaintDetailPage() {
  const { t } = useTranslation("complaints");
  const localized = useLocalized();
  const { id } = useParams();
  const [viewer, setViewer] = useState(null);
  const [reopening, setReopening] = useState(false);
  const [shown, setShown] = useState("after");

  const q = useQuery({
    queryKey: ["complaint", id],
    queryFn: () => complaintsApi.get(id),
    retry: (n, err) => apiError(err).status !== 404 && n < 2,
  });

  useSocketEvent("complaint:updated", (payload) => {
    if (payload?.id !== id) return;
    q.refetch();
    toast(t("detail.statusUpdated"));
  });

  if (q.isLoading) return <ListSkeleton rows={4} />;
  if (q.isError) {
    const e = apiError(q.error);
    if (e.status === 404 || e.status === 403)
      return (
        <EmptyState
          headingLevel={1}
          icon={SearchOffRounded}
          title={t("detail.notFound")}
          action={
            <Button variant="contained" component={RouterLink} to="/complaints">
              {t("detail.backToList")}
            </Button>
          }
        />
      );
    return <ErrorCard network={e.network} onRetry={() => q.refetch()} />;
  }

  const c = q.data;
  const category = t(`categories.${c.category}`);
  const status = t(`status.${c.status}`, { ns: "common" });
  const photoAlt = t("detail.photoAlt", { category, date: formatDateTime(c.createdAt) });

  const share = async () => {
    const text = t("detail.shareText", { no: c.complaintNo, category, status });
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch (err) {
        if (err?.name === "AbortError") return;
      }
    }
    if (await copyText(text)) toast(t("detail.shareCopied"));
  };

  const listenText = [
    t("detail.listenText", { no: c.complaintNo, category, status }),
    c.department ? t("detail.listenDept", { dept: localized(c.department.name) }) : "",
  ].join(" ");

  const copyNo = async () => {
    if (await copyText(c.complaintNo)) toast(t("success.copied"));
  };

  const photo = c.resolutionImageUrl && shown === "after" ? c.resolutionImageUrl : c.imageUrl;

  return (
    <Stack spacing={3} sx={{ maxWidth: 720, mx: "auto", pb: 4 }}>
      {photo && (
        <Stack spacing={1}>
          <ButtonBase
            onClick={() => setViewer(photo)}
            aria-label={t("detail.viewPhoto")}
            sx={{ borderRadius: 2, overflow: "hidden", bgcolor: "#000", display: "block" }}
          >
            <Box
              component="img"
              src={photo}
              alt={photoAlt}
              sx={{ display: "block", width: "100%", maxHeight: 320, objectFit: "contain" }}
            />
          </ButtonBase>
          {c.resolutionImageUrl && c.imageUrl && (
            <ToggleButtonGroup
              exclusive
              value={shown}
              onChange={(_e, v) => v && setShown(v)}
              aria-label={t("detail.resolutionPhoto")}
              fullWidth
            >
              <ToggleButton value="before">{t("detail.before")}</ToggleButton>
              <ToggleButton value="after">{t("detail.after")}</ToggleButton>
            </ToggleButtonGroup>
          )}
        </Stack>
      )}

      <Stack spacing={1.5}>
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <Typography variant="h1" component="h1" sx={{ fontSize: "1.5rem" }}>
            {c.complaintNo}
          </Typography>
          <IconButton
            onClick={copyNo}
            aria-label={t("detail.copyNo")}
            sx={{ width: 48, height: 48 }}
          >
            <ContentCopyRounded />
          </IconButton>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography sx={{ fontWeight: 500 }}>{category}</Typography>
          <StatusChip status={c.status} />
        </Stack>
        {c.supporterCount > 0 && (
          <Typography sx={{ fontWeight: 500, color: "secondary.dark" }}>
            👥 {t("detail.supporters", { count: c.supporterCount })}
          </Typography>
        )}
        <ListenButton
          variant="button"
          text={listenText}
          label={t("detail.listen")}
          sx={{ alignSelf: { sm: "flex-start" }, minHeight: 48 }}
        />
      </Stack>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="h2" sx={{ fontSize: "1.25rem", mb: 1 }}>
          {t("detail.timeline")}
        </Typography>
        <Timeline complaint={c} />
      </Paper>

      <Paper variant="outlined" sx={{ px: 2 }}>
        {c.department && (
          <DetailRow label={t("detail.department")}>
            <Typography>{localized(c.department.name)}</Typography>
          </DetailRow>
        )}
        {c.location && (
          <DetailRow label={t("detail.location")}>
            <Stack spacing={1}>
              {localized(c.village) && <Typography>{localized(c.village)}</Typography>}
              <MapView center={c.location} height={160} showLink={false} />
              <Link
                href={mapsLink(c.location)}
                target="_blank"
                rel="noopener"
                sx={{ fontWeight: 500 }}
              >
                {t("detail.openMaps")}
              </Link>
            </Stack>
          </DetailRow>
        )}
        {c.landmark && (
          <DetailRow label={t("detail.landmark")}>
            <Typography>{c.landmark}</Typography>
          </DetailRow>
        )}
        {c.description && (
          <DetailRow label={t("detail.description")}>
            <Typography sx={{ whiteSpace: "pre-wrap" }}>{c.description}</Typography>
          </DetailRow>
        )}
        {c.onBehalfOf && (
          <DetailRow label={t("detail.onBehalf")}>
            <Typography>{c.onBehalfOf.name}</Typography>
          </DetailRow>
        )}
      </Paper>

      {c.canReopen && (
        <Button variant="contained" color="secondary" onClick={() => setReopening(true)}>
          {t("detail.reopen")}
        </Button>
      )}
      {c.status === "RESOLVED" && !c.canReopen && (
        <Notice
          title={t("detail.reopenExpired")}
          action={
            <Button variant="outlined" component={RouterLink} to="/complaints/new">
              {t("detail.newComplaint")}
            </Button>
          }
        />
      )}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
        <WhatsAppShare
          fullWidth
          text={t("detail.shareText", { no: c.complaintNo, category, status })}
        />
        <Button fullWidth variant="outlined" startIcon={<ShareRounded />} onClick={share}>
          {t("detail.share")}
        </Button>
      </Stack>

      <ReopenDialog open={reopening} complaintId={id} onClose={() => setReopening(false)} />
      <Dialog fullScreen open={Boolean(viewer)} onClose={() => setViewer(null)}>
        <Box sx={{ position: "relative", height: "100%", bgcolor: "#000", overflow: "auto" }}>
          <IconButton
            onClick={() => setViewer(null)}
            aria-label={t("actions.close", { ns: "common" })}
            sx={{
              position: "fixed",
              top: 8,
              right: 8,
              color: "#fff",
              bgcolor: "rgba(0,0,0,0.5)",
              zIndex: 1,
            }}
          >
            <CloseRounded />
          </IconButton>
          {viewer && (
            <Box
              component="img"
              src={viewer}
              alt={photoAlt}
              sx={{
                width: "100%",
                minHeight: "100%",
                objectFit: "contain",
                touchAction: "pinch-zoom",
              }}
            />
          )}
        </Box>
      </Dialog>
    </Stack>
  );
}
