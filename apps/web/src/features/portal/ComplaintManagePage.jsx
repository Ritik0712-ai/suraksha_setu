import { useState } from "react";
import {
  Box,
  Button,
  ButtonBase,
  Chip,
  Dialog,
  IconButton,
  Link,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import {
  ArrowBackRounded,
  CloseRounded,
  PhotoCameraRounded,
  SearchOffRounded,
  VisibilityRounded,
} from "@mui/icons-material";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link as RouterLink, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import C from "../../config/constants.js";
import { apiError } from "../../api/client.js";
import { complaintsApi } from "../../api/endpoints.js";
import { mapsLink } from "../../lib/geo.js";
import { useLocalized } from "../../lib/localized.js";
import { compressPhoto } from "../../lib/photo.js";
import { useSocketEvent } from "../../lib/socket.js";
import { formatDateTime } from "../../lib/time.js";
import { toast } from "../../stores/toast.js";
import { MapView } from "../../components/ui/MapView.jsx";
import { ConfirmDialog, ResponsiveDialog } from "../../components/ui/ResponsiveDialog.jsx";
import { EmptyState, ErrorCard, ListSkeleton } from "../../components/ui/States.jsx";
import { StatusChip } from "../../components/ui/StatusChip.jsx";
import { SubmitButton } from "../../components/ui/fields.jsx";
import { MeTooBadge, Section } from "./ui.jsx";

/** Runs a write; on 409 (someone else changed it) reloads and says so (docs/03 A-03). */
function useAction(id) {
  const { t } = useTranslation("portal");
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const run = async (fn) => {
    setBusy(true);
    try {
      const updated = await fn();
      qc.setQueryData(["admin", "complaint", id], updated);
      qc.invalidateQueries({ queryKey: ["admin", "complaints"] });
      toast(t("common.updated"));
      return true;
    } catch (err) {
      const e = apiError(err);
      if (e.status === 409) {
        toast(t("common.reloaded"), "warning");
        qc.invalidateQueries({ queryKey: ["admin", "complaint", id] });
        return true;
      }
      toast(e.network ? t("states.networkError", { ns: "common" }) : e.message, "error");
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, run };
}

function FormDialog({ open, title, onClose, onSubmit, busy, submitLabel, children, labelId }) {
  const { t } = useTranslation("portal");
  return (
    <ResponsiveDialog
      open={open}
      onClose={busy ? undefined : onClose}
      title={title}
      labelId={labelId}
      actions={
        <>
          <Button variant="outlined" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <SubmitButton type="button" busy={busy} onClick={onSubmit}>
            {submitLabel}
          </SubmitButton>
        </>
      }
    >
      <Stack spacing={2.5} sx={{ pt: 1 }}>
        {children}
      </Stack>
    </ResponsiveDialog>
  );
}

function AssignDialog({ complaint, open, onClose, act }) {
  const { t } = useTranslation("portal");
  const localized = useLocalized();
  const opts = useQuery({
    queryKey: ["admin", "assign-options", complaint.id],
    queryFn: () => complaintsApi.assignOptions(complaint.id),
    enabled: open,
  });
  const [dept, setDept] = useState(complaint.departmentId);
  const [assignee, setAssignee] = useState(complaint.assignee?.id ?? "");
  const [note, setNote] = useState("");
  const officers = (opts.data?.assignees ?? []).filter(
    (o) => !o.departmentId || o.departmentId === dept,
  );
  const submit = async () => {
    const ok = await act.run(() =>
      complaintsApi.assign(complaint.id, {
        departmentId: dept,
        assigneeId: assignee || null,
        ...(note.trim() ? { publicNote: note.trim() } : {}),
      }),
    );
    if (ok) onClose();
  };
  return (
    <FormDialog
      open={open}
      title={t("manage.assignTitle")}
      onClose={onClose}
      onSubmit={submit}
      busy={act.busy}
      submitLabel={t("manage.actions.assign")}
      labelId="assign-title"
    >
      <TextField
        select
        label={t("manage.department")}
        value={dept}
        onChange={(e) => {
          setDept(e.target.value);
          setAssignee("");
        }}
        fullWidth
      >
        {(opts.data?.departments ?? []).map((d) => (
          <MenuItem key={d.id} value={d.id}>
            {localized(d.name)}
            {d.handlesCategory ? ` — ${t("manage.handles")}` : ""}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        select
        label={t("manage.assigneeOptional")}
        value={assignee}
        onChange={(e) => setAssignee(e.target.value)}
        fullWidth
        SelectProps={{ displayEmpty: true }}
      >
        <MenuItem value="">{t("manage.anyone")}</MenuItem>
        {officers.map((o) => (
          <MenuItem key={o.id} value={o.id}>
            {o.name}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        label={t("manage.publicNoteOptional")}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        multiline
        minRows={2}
        inputProps={{ maxLength: 1000 }}
        fullWidth
      />
    </FormDialog>
  );
}

function StatusDialog({ complaint, status, onClose, act }) {
  const { t } = useTranslation("portal");
  const [note, setNote] = useState("");
  const [code, setCode] = useState("");
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState(null);
  const [error, setError] = useState(null);
  const open = Boolean(status);

  const submit = async () => {
    setError(null);
    const body = { status };
    if (status === "REJECTED") {
      if (!code || (code === "other" && !text.trim()))
        return setError(t("errors.required", { ns: "common" }));
      body.rejection = { code, ...(text.trim() ? { text: text.trim() } : {}) };
    }
    if (status === "RESOLVED") {
      if (!note.trim()) return setError(t("errors.required", { ns: "common" }));
      body.publicNote = note.trim();
    }
    if (status === "SUBMITTED") {
      if (!note.trim()) return setError(t("errors.required", { ns: "common" }));
      body.internalNote = note.trim();
    }
    const ok = await act.run(async () => {
      // The photo goes first (it's allowed while IN_PROGRESS), then the status change.
      if (photo) await complaintsApi.resolutionPhoto(complaint.id, await compressPhoto(photo));
      return complaintsApi.setStatus(complaint.id, body);
    });
    if (ok) onClose();
  };

  const title = { REJECTED: "rejectTitle", RESOLVED: "resolveTitle", SUBMITTED: "restoreTitle" }[
    status
  ];
  return (
    <FormDialog
      open={open}
      title={title ? t(`manage.${title}`) : ""}
      onClose={onClose}
      onSubmit={submit}
      busy={act.busy}
      submitLabel={status ? t(`manage.actions.${status}`) : ""}
      labelId="status-title"
    >
      {status === "REJECTED" && (
        <>
          <TextField
            select
            label={t("manage.reason")}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            fullWidth
            error={Boolean(error) && !code}
          >
            {C.rejectionReasons.map((r) => (
              <MenuItem key={r} value={r}>
                {t(`rejection.${r}`, { ns: "complaints" })}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label={t("manage.reasonText")}
            value={text}
            onChange={(e) => setText(e.target.value)}
            multiline
            minRows={2}
            inputProps={{ maxLength: 300 }}
            fullWidth
          />
        </>
      )}
      {status === "RESOLVED" && (
        <>
          <TextField
            label={t("manage.resolveNote")}
            placeholder={t("manage.resolveHint")}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            multiline
            minRows={2}
            inputProps={{ maxLength: 1000 }}
            fullWidth
            error={Boolean(error)}
          />
          <Button variant="outlined" component="label" startIcon={<PhotoCameraRounded />}>
            {photo ? t("manage.photoChosen", { name: photo.name }) : t("manage.addPhoto")}
            <input
              hidden
              type="file"
              accept="image/*"
              data-testid="resolution-input"
              onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
            />
          </Button>
        </>
      )}
      {status === "SUBMITTED" && (
        <TextField
          label={t("manage.restoreNote")}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          multiline
          minRows={2}
          fullWidth
          error={Boolean(error)}
        />
      )}
      {error && (
        <Typography color="error" role="alert">
          {error}
        </Typography>
      )}
    </FormDialog>
  );
}

function Notes({ complaint, act }) {
  const { t } = useTranslation("portal");
  const [tab, setTab] = useState("public");
  const [text, setText] = useState("");
  const add = async () => {
    if (!text.trim()) return;
    const ok = await act.run(() =>
      complaintsApi.addNote(complaint.id, { visibility: tab, text: text.trim() }),
    );
    if (ok) setText("");
  };
  return (
    <Section title={t("manage.notes")}>
      <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 1.5 }}>
        <Tab value="public" label={t("manage.publicTab")} />
        <Tab value="internal" label={t("manage.internalTab")} />
      </Tabs>
      <TextField
        label={t(tab === "public" ? "manage.publicTab" : "manage.internalTab")}
        helperText={t(tab === "public" ? "manage.publicHint" : "manage.internalHint")}
        value={text}
        onChange={(e) => setText(e.target.value)}
        multiline
        minRows={2}
        inputProps={{ maxLength: 1000 }}
        fullWidth
      />
      <Button variant="contained" onClick={add} disabled={!text.trim() || act.busy} sx={{ mt: 1 }}>
        {t("manage.addNote")}
      </Button>
    </Section>
  );
}

function Timeline({ complaint }) {
  const { t } = useTranslation("portal");
  const cat = (c) => t(`categories.${c}`, { ns: "complaints" });
  return (
    <Section title={t("manage.timeline")}>
      <Stack component="ol" spacing={1.5} sx={{ listStyle: "none", p: 0, m: 0 }}>
        {[...complaint.timeline].reverse().map((e, i) => (
          <Box
            component="li"
            key={i}
            sx={{
              borderLeft: "3px solid",
              borderColor: e.visibility === "internal" ? "#B45309" : "primary.main",
              pl: 1.5,
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Typography sx={{ fontWeight: 500 }}>
                {e.type === "category_changed" && e.meta
                  ? t("manage.events.category_changed", {
                      from: cat(e.meta.from),
                      to: cat(e.meta.to),
                    })
                  : t(`manage.events.${e.type}`)}
              </Typography>
              {e.toStatus && <StatusChip status={e.toStatus} size="small" />}
              {e.visibility === "internal" && (
                <Chip
                  size="small"
                  label={t("manage.internal")}
                  color="warning"
                  variant="outlined"
                />
              )}
            </Stack>
            {e.text && <Typography sx={{ whiteSpace: "pre-wrap" }}>{e.text}</Typography>}
            <Typography variant="body2" color="text.secondary">
              {formatDateTime(e.at)}
              {e.actorName ? ` · ${t("manage.by", { name: e.actorName })}` : ""}
            </Typography>
          </Box>
        ))}
      </Stack>
    </Section>
  );
}

/** A-03 Complaint management (docs/03). */
export default function ComplaintManagePage() {
  const { t } = useTranslation("portal");
  const localized = useLocalized();
  const { id } = useParams();
  const act = useAction(id);
  const [dialog, setDialog] = useState(null); // "assign" | status
  const [category, setCategory] = useState(null);
  const [phones, setPhones] = useState({});
  const [viewer, setViewer] = useState(null);
  const q = useQuery({
    queryKey: ["admin", "complaint", id],
    queryFn: () => complaintsApi.get(id),
    retry: (n, err) => ![403, 404].includes(apiError(err).status) && n < 2,
  });
  useSocketEvent("complaint:updated", (p) => p?.id === id && q.refetch());

  if (q.isLoading) return <ListSkeleton rows={5} />;
  if (q.isError) {
    const e = apiError(q.error);
    if (e.status === 404 || e.status === 403)
      return (
        <EmptyState
          headingLevel={1}
          icon={SearchOffRounded}
          title={t("detail.notFound", { ns: "complaints" })}
          action={
            <Button variant="contained" component={RouterLink} to="/portal/complaints">
              {t("manage.back")}
            </Button>
          }
        />
      );
    return <ErrorCard network={e.network} onRetry={() => q.refetch()} />;
  }
  const c = q.data;

  const reveal = async (target) => {
    try {
      const { phone } = await complaintsApi.revealPhone(c.id, target);
      setPhones((p) => ({ ...p, [target]: phone }));
    } catch (err) {
      toast(apiError(err).message, "error");
    }
  };

  const onStatus = (s) => {
    if (s === "VERIFIED" || s === "IN_PROGRESS")
      act.run(() => complaintsApi.setStatus(c.id, { status: s }));
    else setDialog(s);
  };

  const ai = c.aiSuggestion;
  return (
    <Stack spacing={2}>
      <Box>
        <Button component={RouterLink} to="/portal/complaints" startIcon={<ArrowBackRounded />}>
          {t("manage.back")}
        </Button>
      </Box>
      <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
        <Typography variant="h1" sx={{ fontSize: "1.75rem" }}>
          {c.complaintNo}
        </Typography>
        <StatusChip status={c.status} />
        <MeTooBadge count={c.supporterCount} long />
        <Typography color="text.secondary">
          {t(`categories.${c.category}`, { ns: "complaints" })}
        </Typography>
      </Stack>

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", lg: "3fr 2fr" },
          alignItems: "start",
        }}
      >
        <Stack spacing={2}>
          {(c.imageUrl || c.resolutionImageUrl) && (
            <Section>
              <Stack direction="row" spacing={1.5}>
                {[
                  [c.imageUrl, "manage.photo"],
                  [c.resolutionImageUrl, "manage.resolutionPhoto"],
                ]
                  .filter(([u]) => u)
                  .map(([url, label]) => (
                    <Box key={label} sx={{ flex: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        {t(label)}
                      </Typography>
                      <ButtonBase
                        onClick={() => setViewer(url)}
                        sx={{
                          display: "block",
                          width: "100%",
                          borderRadius: 1,
                          overflow: "hidden",
                          bgcolor: "#000",
                        }}
                      >
                        <Box
                          component="img"
                          src={url}
                          alt={t(label)}
                          sx={{
                            display: "block",
                            width: "100%",
                            maxHeight: 280,
                            objectFit: "contain",
                          }}
                        />
                      </ButtonBase>
                    </Box>
                  ))}
              </Stack>
            </Section>
          )}
          <Section title={t("manage.location")}>
            <Stack spacing={1}>
              {c.location && <MapView center={c.location} height={200} showLink={false} />}
              <Typography>
                {[localized(c.village), c.landmark].filter(Boolean).join(" · ")}
              </Typography>
              {c.location && (
                <Link href={mapsLink(c.location)} target="_blank" rel="noopener">
                  {t("detail.openMaps", { ns: "complaints" })}
                </Link>
              )}
            </Stack>
          </Section>
          <Section title={t("manage.citizen")}>
            <Stack spacing={1}>
              {c.citizen ? (
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Typography sx={{ fontWeight: 500 }}>{c.citizen.name}</Typography>
                  {phones.citizen ? (
                    <Link href={`tel:${phones.citizen}`}>{phones.citizen}</Link>
                  ) : (
                    <>
                      <Typography sx={{ fontFamily: "monospace" }}>
                        {c.citizen.maskedPhone}
                      </Typography>
                      <Button
                        size="small"
                        startIcon={<VisibilityRounded />}
                        onClick={() => reveal("citizen")}
                      >
                        {t("manage.showPhone")}
                      </Button>
                    </>
                  )}
                </Stack>
              ) : (
                <Typography color="text.secondary">{t("manage.noCitizen")}</Typography>
              )}
              {c.onBehalfOf && (
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Typography>
                    {t("manage.onBehalf")}: {c.onBehalfOf.name}
                  </Typography>
                  {c.onBehalfOf.maskedPhone &&
                    (phones.onBehalf ? (
                      <Link href={`tel:${phones.onBehalf}`}>{phones.onBehalf}</Link>
                    ) : (
                      <Button
                        size="small"
                        startIcon={<VisibilityRounded />}
                        onClick={() => reveal("onBehalf")}
                      >
                        {t("manage.showPhone")}
                      </Button>
                    ))}
                </Stack>
              )}
              {c.description && (
                <Typography sx={{ whiteSpace: "pre-wrap" }}>
                  <strong>{t("manage.description")}:</strong> {c.description}
                </Typography>
              )}
              <Typography variant="body2" color="text.secondary">
                {ai
                  ? t("manage.ai", {
                      category: t(`categories.${ai.category}`, { ns: "complaints" }),
                      pct: Math.round(ai.confidence * 100),
                      model: ai.modelVersion,
                    })
                  : t("manage.noAi")}
              </Typography>
            </Stack>
          </Section>
        </Stack>

        <Stack spacing={2}>
          <Section title={t("common.actions")}>
            <Stack spacing={1}>
              <Typography variant="body2" color="text.secondary">
                {t("manage.department")}: {localized(c.department?.name) || "—"} ·{" "}
                {t("manage.assignee")}: {c.assignee?.name ?? t("manage.nobody")}
              </Typography>
              {c.actions.statuses.map((s) => (
                <Button
                  key={s}
                  variant={s === "REJECTED" ? "outlined" : "contained"}
                  color={s === "REJECTED" ? "error" : "primary"}
                  onClick={() => onStatus(s)}
                  disabled={act.busy}
                >
                  {t(`manage.actions.${s}`)}
                </Button>
              ))}
              {c.actions.canAssign && (
                <Button
                  variant={c.status === "VERIFIED" ? "contained" : "outlined"}
                  onClick={() => setDialog("assign")}
                  disabled={act.busy}
                >
                  {t(c.status === "VERIFIED" ? "manage.actions.assign" : "manage.actions.reassign")}
                </Button>
              )}
              {!c.actions.statuses.length && !c.actions.canAssign && (
                <Typography color="text.secondary">{t("manage.actions.none")}</Typography>
              )}
              <TextField
                select
                label={t("manage.category")}
                value={c.category}
                onChange={(e) => setCategory(e.target.value)}
                size="small"
                sx={{ mt: 1 }}
              >
                {C.complaintCategories.map((x) => (
                  <MenuItem key={x} value={x}>
                    {t(`categories.${x}`, { ns: "complaints" })}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
          </Section>
          <Notes complaint={c} act={act} />
          <Timeline complaint={c} />
        </Stack>
      </Box>

      {dialog === "assign" && (
        <AssignDialog complaint={c} open onClose={() => setDialog(null)} act={act} />
      )}
      <StatusDialog
        key={dialog ?? "none"}
        complaint={c}
        status={dialog && dialog !== "assign" ? dialog : null}
        onClose={() => setDialog(null)}
        act={act}
      />
      <ConfirmDialog
        open={Boolean(category)}
        title={t("manage.category")}
        body={
          category
            ? t("manage.categoryConfirm", {
                category: t(`categories.${category}`, { ns: "complaints" }),
              })
            : ""
        }
        confirmLabel={t("common.save")}
        cancelLabel={t("common.cancel")}
        busy={act.busy}
        onCancel={() => setCategory(null)}
        onConfirm={async () => {
          await act.run(() => complaintsApi.setCategory(c.id, { category }));
          setCategory(null);
        }}
      />
      <Dialog fullScreen open={Boolean(viewer)} onClose={() => setViewer(null)}>
        <Box sx={{ position: "relative", height: "100%", bgcolor: "#000", overflow: "auto" }}>
          <IconButton
            onClick={() => setViewer(null)}
            aria-label={t("actions.close", { ns: "common" })}
            sx={{ position: "fixed", top: 8, right: 8, color: "#fff", bgcolor: "rgba(0,0,0,0.5)" }}
          >
            <CloseRounded />
          </IconButton>
          {viewer && (
            <Box component="img" src={viewer} alt="" sx={{ width: "100%", objectFit: "contain" }} />
          )}
        </Box>
      </Dialog>
    </Stack>
  );
}
