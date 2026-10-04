import { useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  ButtonBase,
  Chip,
  CircularProgress,
  FormControlLabel,
  Link,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { AutoAwesomeRounded, PhotoCameraRounded, PhotoLibraryRounded } from "@mui/icons-material";
import { useQuery } from "@tanstack/react-query";
import { useBlocker, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { apiError } from "../../api/client.js";
import { complaintsApi } from "../../api/endpoints.js";
import { getPosition } from "../../lib/geo.js";
import { compressPhoto, isImageFile } from "../../lib/photo.js";
import { toTenDigits } from "../../lib/phone.js";
import { isDraftDirty, useComplaintDraft } from "../../stores/complaintDraft.js";
import { HighlightCard, Notice } from "../../components/ui/Notice.jsx";
import { ConfirmDialog } from "../../components/ui/ResponsiveDialog.jsx";
import { WizardFrame } from "../../components/ui/WizardFrame.jsx";
import { PhoneField, SubmitButton } from "../../components/ui/fields.jsx";
import { CategoryIcon } from "./categories.jsx";
import { CATEGORIES, buildComplaintBody, confidenceLabel, useLocalized } from "./complaintUtils.js";
import { LocationPicker } from "./LocationPicker.jsx";
import { MicButton } from "../../components/ui/Speech.jsx";
import { appendSpoken } from "../../lib/speech.js";

const TOTAL = 4;
const SHOW_AI_FROM = 0.6; // docs/03 S-10 step 2

// --- Step 1: photo --------------------------------------------------------------------------

function PhotoStep({ onDone }) {
  const { t } = useTranslation("complaints");
  const { photo, upload, setPhoto, update } = useComplaintDraft();
  const camera = useRef(null);
  const gallery = useRef(null);
  const [error, setError] = useState(null); // "notImage" | "uploadFailed" | server message
  const [busy, setBusy] = useState(false);

  const pick = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // choosing the same file again still fires change
    if (!file) return;
    if (!isImageFile(file)) return setError("notImage");
    setError(null);
    setPhoto(file);
  };

  const next = async () => {
    if (!photo || upload) return onDone();
    setBusy(true);
    setError(null);
    try {
      const file = await compressPhoto(photo.file);
      const res = await complaintsApi.classify(file);
      update({
        upload: { uploadId: res.uploadId, imageUrl: res.imageUrl },
        suggestion: res.suggestion,
        aiChecked: true,
      });
      onDone();
    } catch (err) {
      const e = apiError(err);
      setError(
        e.code === "VALIDATION_ERROR" || e.code === "RATE_LIMITED" ? e.message : "uploadFailed",
      );
    } finally {
      setBusy(false);
    }
  };

  const withoutPhoto = () => {
    setPhoto(null);
    onDone();
  };

  const errorText = error && (t(`photo.${error}`, { defaultValue: "" }) || error);

  return (
    <Stack spacing={2.5}>
      <Typography variant="h2">{t("photo.heading")}</Typography>
      <input
        ref={camera}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={pick}
        data-testid="camera-input"
      />
      <input
        ref={gallery}
        type="file"
        accept="image/*"
        hidden
        onChange={pick}
        data-testid="gallery-input"
      />
      {photo ? (
        <Box sx={{ position: "relative", borderRadius: 2, overflow: "hidden", bgcolor: "#000" }}>
          <Box
            component="img"
            src={photo.previewUrl}
            alt={t("photo.previewAlt")}
            sx={{ display: "block", width: "100%", maxHeight: 360, objectFit: "contain" }}
          />
          {busy && (
            <Stack
              role="status"
              alignItems="center"
              justifyContent="center"
              spacing={1.5}
              sx={{ position: "absolute", inset: 0, bgcolor: "rgba(0,0,0,0.55)", color: "#fff" }}
            >
              <CircularProgress color="inherit" />
              <Typography sx={{ fontWeight: 500 }}>{t("photo.checking")}</Typography>
            </Stack>
          )}
        </Box>
      ) : (
        <Stack spacing={1.5}>
          <Button
            variant="contained"
            size="large"
            startIcon={<PhotoCameraRounded />}
            onClick={() => camera.current?.click()}
            sx={{ minHeight: 72 }}
          >
            {t("photo.takePhoto")}
          </Button>
          <Button
            variant="outlined"
            size="large"
            startIcon={<PhotoLibraryRounded />}
            onClick={() => gallery.current?.click()}
            sx={{ minHeight: 72 }}
          >
            {t("photo.fromGallery")}
          </Button>
          <Typography color="text.secondary">{t("photo.tip")}</Typography>
        </Stack>
      )}

      {errorText && (
        <Notice
          kind="error"
          title={errorText}
          action={
            error === "uploadFailed" && (
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Button variant="outlined" size="small" onClick={next}>
                  {t("actions.retry", { ns: "common" })}
                </Button>
                <Button size="small" onClick={withoutPhoto}>
                  {t("photo.continueWithout")}
                </Button>
              </Stack>
            )
          }
        />
      )}

      {photo ? (
        <Stack spacing={1.5}>
          <SubmitButton type="button" busy={busy} onClick={next}>
            {t("actions.next", { ns: "common" })}
          </SubmitButton>
          <Button variant="outlined" disabled={busy} onClick={() => camera.current?.click()}>
            {t("photo.retake")}
          </Button>
        </Stack>
      ) : (
        <Link component="button" type="button" onClick={withoutPhoto} sx={{ py: 1.5 }}>
          {t("photo.skip")}
        </Link>
      )}
    </Stack>
  );
}

// --- Step 2: category -----------------------------------------------------------------------

function CategoryTile({ category, selected, ai, onSelect }) {
  const { t } = useTranslation("complaints");
  return (
    <ButtonBase
      role="radio"
      aria-checked={selected}
      onClick={() => onSelect(category)}
      sx={{
        position: "relative",
        flexDirection: "column",
        gap: 1,
        p: 2,
        minHeight: 112,
        borderRadius: 2,
        border: "2px solid",
        borderColor: selected ? "primary.main" : "divider",
        bgcolor: selected ? "primary.light" : "background.paper",
        textAlign: "center",
        "&:focus-visible": { outline: "3px solid #C2410C", outlineOffset: 2 },
      }}
    >
      {ai && (
        <Chip
          label={t("category.aiBadge")}
          size="small"
          color="secondary"
          sx={{ position: "absolute", top: 6, right: 6, height: 22, fontWeight: 700 }}
        />
      )}
      <CategoryIcon category={category} sx={{ fontSize: 40, color: "primary.main" }} />
      <Typography sx={{ fontWeight: 500, lineHeight: 1.3 }}>
        {t(`categories.${category}`)}
      </Typography>
    </ButtonBase>
  );
}

function CategoryStep({ onDone }) {
  const { t } = useTranslation("complaints");
  const { suggestion, category, update } = useComplaintDraft();
  const confident = suggestion && suggestion.confidence >= SHOW_AI_FROM;
  const [grid, setGrid] = useState(!confident || (category && category !== suggestion.category));
  const label = suggestion ? confidenceLabel(suggestion.confidence) : null;

  if (confident && !grid)
    return (
      <Stack spacing={2.5}>
        <Typography variant="h2">{t("category.heading")}</Typography>
        <HighlightCard>
          <Stack direction="row" spacing={2} alignItems="center">
            <CategoryIcon
              category={suggestion.category}
              sx={{ fontSize: 48, color: "primary.main" }}
            />
            <Box>
              <Typography sx={{ fontSize: "1.125rem" }}>
                <AutoAwesomeRounded
                  sx={{ fontSize: 18, mr: 0.5, verticalAlign: "text-bottom" }}
                  aria-hidden
                />
                {t("category.aiThinks", {
                  category: t(`categories.${suggestion.category}`),
                })}
              </Typography>
              {label && (
                <Chip label={t(`category.${label}`)} size="small" sx={{ mt: 1, fontWeight: 500 }} />
              )}
            </Box>
          </Stack>
        </HighlightCard>
        <Button
          variant="contained"
          onClick={() => {
            update({ category: suggestion.category });
            onDone();
          }}
        >
          {t("category.yes")}
        </Button>
        <Button variant="outlined" onClick={() => setGrid(true)}>
          {t("category.chooseAnother")}
        </Button>
      </Stack>
    );

  return (
    <Stack spacing={2.5}>
      <Typography variant="h2" id="category-label">
        {t("category.pick")}
      </Typography>
      <Box
        role="radiogroup"
        aria-labelledby="category-label"
        sx={{
          display: "grid",
          gap: 1.5,
          gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(3, 1fr)" },
        }}
      >
        {CATEGORIES.map((c) => (
          <CategoryTile
            key={c}
            category={c}
            selected={category === c}
            ai={confident && suggestion.category === c}
            onSelect={(v) => update({ category: v })}
          />
        ))}
      </Box>
      <Button variant="contained" disabled={!category} onClick={onDone}>
        {t("actions.next", { ns: "common" })}
      </Button>
    </Stack>
  );
}

// --- Step 3: location and details -----------------------------------------------------------

function DetailsStep({ onDone }) {
  const { t } = useTranslation("complaints");
  const draft = useComplaintDraft();
  const { update } = draft;
  const [locating, setLocating] = useState(false);
  const [errors, setErrors] = useState({});

  const locate = async () => {
    setLocating(true);
    try {
      const pos = await getPosition();
      update({ location: pos, locationSource: "gps" });
    } catch {
      if (!useComplaintDraft.getState().location) update({ locationSource: "village" });
    } finally {
      setLocating(false);
    }
  };

  // First visit: try GPS once (docs/03 S-10 step 3).
  useEffect(() => {
    if (!useComplaintDraft.getState().locationSource) locate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const next = () => {
    const e = {};
    if (draft.onBehalf) {
      const name = draft.onBehalfName.trim();
      if (name.length < 2) e.onBehalfName = t("errors.required", { ns: "common" });
      if (draft.onBehalfPhone && !toTenDigits(draft.onBehalfPhone))
        e.onBehalfPhone = t("errors.invalid_phone", { ns: "common" });
    }
    setErrors(e);
    if (!Object.keys(e).length) onDone();
  };

  return (
    <Stack spacing={2.5}>
      <Typography variant="h2">{t("details.heading")}</Typography>
      <LocationPicker
        value={draft.location}
        source={draft.locationSource}
        locating={locating}
        onLocate={locate}
        onChange={(p, source) =>
          update({ location: { ...p, accuracyM: undefined }, locationSource: source })
        }
      />
      <TextField
        id="complaint-landmark"
        label={t("details.landmark")}
        placeholder={t("details.landmarkPlaceholder")}
        value={draft.landmark}
        onChange={(e) => update({ landmark: e.target.value })}
        inputProps={{ maxLength: 100 }}
        fullWidth
      />
      <Stack direction="row" spacing={1} alignItems="flex-start">
        <TextField
          id="complaint-description"
          label={t("details.description")}
          value={draft.description}
          onChange={(e) => update({ description: e.target.value })}
          inputProps={{ maxLength: 500 }}
          helperText={`${t("details.descriptionHint")} · ${draft.description.length}/500`}
          multiline
          minRows={3}
          fullWidth
        />
        <MicButton
          onText={(said) => update({ description: appendSpoken(draft.description, said, 500) })}
        />
      </Stack>
      <FormControlLabel
        control={
          <Switch
            checked={draft.onBehalf}
            onChange={(e) => update({ onBehalf: e.target.checked })}
          />
        }
        label={t("details.onBehalf")}
      />
      {draft.onBehalf && (
        <Stack spacing={2.5}>
          <TextField
            id="complaint-behalf-name"
            label={t("details.onBehalfName")}
            value={draft.onBehalfName}
            onChange={(e) => update({ onBehalfName: e.target.value })}
            inputProps={{ maxLength: 60 }}
            error={Boolean(errors.onBehalfName)}
            helperText={errors.onBehalfName}
            required
            fullWidth
          />
          <PhoneField
            id="complaint-behalf-phone"
            label={t("details.onBehalfPhone")}
            value={draft.onBehalfPhone}
            onChange={(v) => update({ onBehalfPhone: v })}
            error={Boolean(errors.onBehalfPhone)}
            helperText={errors.onBehalfPhone}
          />
        </Stack>
      )}
      <Button variant="contained" onClick={next} disabled={locating && !draft.location}>
        {t("actions.next", { ns: "common" })}
      </Button>
    </Stack>
  );
}

// --- Step 4: review -------------------------------------------------------------------------

function ReviewRow({ label, onEdit, children }) {
  const { t } = useTranslation("complaints");
  return (
    <Box sx={{ py: 1.5, borderBottom: "1px solid", borderColor: "divider" }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
        <Button size="small" onClick={onEdit} aria-label={`${t("review.edit")}: ${label}`}>
          {t("review.edit")}
        </Button>
      </Stack>
      <Box sx={{ mt: 0.5 }}>{children}</Box>
    </Box>
  );
}

function ReviewStep({ goTo, onSubmitted }) {
  const { t } = useTranslation("complaints");
  const localized = useLocalized();
  const draft = useComplaintDraft();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const preview = useQuery({
    queryKey: ["complaint-route", draft.category, draft.location?.lat, draft.location?.lng],
    queryFn: () =>
      complaintsApi.routePreview({
        category: draft.category,
        ...(draft.location ? { lat: draft.location.lat, lng: draft.location.lng } : {}),
      }),
    enabled: Boolean(draft.category), // the draft is cleared right after submit
    staleTime: 5 * 60_000,
    retry: false,
  });
  const dept = localized(preview.data?.department?.name) || t("review.defaultDept");

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const created = await complaintsApi.create(buildComplaintBody(draft));
      onSubmitted(created);
    } catch (err) {
      const e = apiError(err);
      setError(e.network ? t("states.networkError", { ns: "common" }) : e.message);
      setBusy(false);
    }
  };

  return (
    <Stack spacing={2}>
      <Typography variant="h2">{t("review.heading")}</Typography>
      <Paper variant="outlined" sx={{ px: 2 }}>
        <ReviewRow label={t("review.photo")} onEdit={() => goTo(1)}>
          {draft.photo ? (
            <Box
              component="img"
              src={draft.photo.previewUrl}
              alt={t("photo.previewAlt")}
              sx={{ width: 96, height: 96, objectFit: "cover", borderRadius: 1 }}
            />
          ) : (
            <Typography>{t("review.noPhoto")}</Typography>
          )}
        </ReviewRow>
        <ReviewRow label={t("review.category")} onEdit={() => goTo(2)}>
          <Stack direction="row" spacing={1} alignItems="center">
            <CategoryIcon category={draft.category} sx={{ color: "primary.main" }} />
            <Typography sx={{ fontWeight: 500 }}>{t(`categories.${draft.category}`)}</Typography>
          </Stack>
        </ReviewRow>
        <ReviewRow label={t("review.location")} onEdit={() => goTo(3)}>
          <Typography>
            {draft.location
              ? `${draft.location.lat.toFixed(5)}, ${draft.location.lng.toFixed(5)}`
              : t("review.villageLocation")}
          </Typography>
          {draft.landmark.trim() && <Typography>{draft.landmark.trim()}</Typography>}
        </ReviewRow>
        <ReviewRow label={t("review.description")} onEdit={() => goTo(3)}>
          <Typography sx={{ whiteSpace: "pre-wrap" }}>
            {draft.description.trim() || t("review.noDescription")}
          </Typography>
        </ReviewRow>
        {draft.onBehalf && draft.onBehalfName.trim() && (
          <ReviewRow label={t("review.onBehalf")} onEdit={() => goTo(3)}>
            <Typography>{draft.onBehalfName.trim()}</Typography>
          </ReviewRow>
        )}
      </Paper>
      <Typography>
        {t("review.goesTo")} <strong>{dept}</strong>
      </Typography>
      {error && <Notice kind="error" title={error} />}
      <SubmitButton type="button" busy={busy} onClick={submit}>
        {t("review.submit")}
      </SubmitButton>
    </Stack>
  );
}

// --- Page -----------------------------------------------------------------------------------

/** S-10 New complaint — 4-step wizard (docs/03). */
export default function NewComplaintPage() {
  const { t } = useTranslation("complaints");
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const submitted = useRef(false);
  const dirty = useComplaintDraft(isDraftDirty);
  const reset = useComplaintDraft((s) => s.reset);

  // Wake the AI service while the citizen takes the photo (docs/02 §12).
  useEffect(() => {
    complaintsApi.warmup().catch(() => {});
  }, []);

  // Leaving with unsaved data asks first (docs/03 S-10 "Discard this complaint?").
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && !submitted.current && currentLocation.pathname !== nextLocation.pathname,
  );

  const back = () => {
    if (step > 1) return setStep(step - 1);
    if (window.history.state?.idx > 0) navigate(-1);
    else navigate("/");
  };

  const onSubmitted = (created) => {
    submitted.current = true;
    reset();
    navigate("/complaints/new/success", {
      replace: true,
      state: { id: created.id, complaintNo: created.complaintNo },
    });
  };

  const goNext = () => {
    setStep((s) => Math.min(TOTAL, s + 1));
    window.scrollTo?.(0, 0);
  };

  return (
    <Box sx={{ maxWidth: 640, mx: "auto" }}>
      <WizardFrame title={t("title")} step={step} total={TOTAL} onBack={back}>
        {step === 1 && <PhotoStep onDone={goNext} />}
        {step === 2 && <CategoryStep onDone={goNext} />}
        {step === 3 && <DetailsStep onDone={goNext} />}
        {step === 4 && <ReviewStep goTo={setStep} onSubmitted={onSubmitted} />}
      </WizardFrame>
      <ConfirmDialog
        open={blocker.state === "blocked"}
        title={t("discard.title")}
        body={t("discard.body")}
        confirmLabel={t("discard.confirm")}
        cancelLabel={t("discard.cancel")}
        onCancel={() => blocker.reset?.()}
        onConfirm={() => {
          reset();
          blocker.proceed?.();
        }}
      />
    </Box>
  );
}
