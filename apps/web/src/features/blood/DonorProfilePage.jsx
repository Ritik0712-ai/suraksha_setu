import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { MyLocationRounded } from "@mui/icons-material";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import C from "../../config/constants.js";
import { apiError } from "../../api/client.js";
import { donorsApi } from "../../api/endpoints.js";
import { getPosition } from "../../lib/geo.js";
import { useLocalized } from "../../lib/localized.js";
import { formatDate } from "../../lib/time.js";
import { toast } from "../../stores/toast.js";
import { Notice } from "../../components/ui/Notice.jsx";
import { PageTitle } from "../../components/ui/PageTitle.jsx";
import { ConfirmDialog } from "../../components/ui/ResponsiveDialog.jsx";
import { ErrorCard, ListSkeleton } from "../../components/ui/States.jsx";
import { SubmitButton } from "../../components/ui/fields.jsx";

const pretty = (g) => g.replace("-", "−");
const todayIso = () => new Date().toISOString().slice(0, 10);

function DonorForm({ donor, onSaved, onCancel }) {
  const { t } = useTranslation("blood");
  const [group, setGroup] = useState(donor?.bloodGroup ?? null);
  const [never, setNever] = useState(donor ? !donor.lastDonatedAt : false);
  const [date, setDate] = useState(donor?.lastDonatedAt ? donor.lastDonatedAt.slice(0, 10) : "");
  const [location, setLocation] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locNote, setLocNote] = useState(null);
  const [available, setAvailable] = useState(donor?.available ?? true);
  const [consent, setConsent] = useState(Boolean(donor));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const locate = async () => {
    setLocating(true);
    try {
      setLocation(await getPosition());
      setLocNote(t("profile.located"));
    } catch {
      setLocation(null);
      setLocNote(t("profile.locationFailed"));
    } finally {
      setLocating(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!group) errs.group = t("profile.groupRequired");
    if (!never && date && date > todayIso()) errs.date = t("profile.futureDate");
    if (!consent) errs.consent = t("profile.consentRequired");
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const saved = await donorsApi.save({
        bloodGroup: group,
        lastDonatedAt: never || !date ? null : date,
        location: location ? { lat: location.lat, lng: location.lng } : (donor?.location ?? null),
        available,
        consent: true,
      });
      toast(t("profile.saved"));
      onSaved(saved);
    } catch (err) {
      const x = apiError(err);
      setErrors({ root: x.network ? t("states.networkError", { ns: "common" }) : x.message });
      setBusy(false);
    }
  };

  return (
    <Stack component="form" noValidate spacing={2.5} onSubmit={submit}>
      <Box>
        <Typography id="donor-group" sx={{ fontWeight: 500, mb: 1 }}>
          {t("profile.group")}
        </Typography>
        <Box
          role="radiogroup"
          aria-labelledby="donor-group"
          sx={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1 }}
        >
          {C.bloodGroups.map((g) => (
            <Button
              key={g}
              role="radio"
              aria-checked={group === g}
              aria-label={g}
              variant={group === g ? "contained" : "outlined"}
              color="error"
              onClick={() => setGroup(g)}
              sx={{ minHeight: 56, fontSize: "1.125rem", fontWeight: 700 }}
            >
              {pretty(g)}
            </Button>
          ))}
        </Box>
        {errors.group && (
          <Typography color="error" variant="body2" sx={{ mt: 0.5 }}>
            {errors.group}
          </Typography>
        )}
      </Box>
      <Stack spacing={1}>
        <TextField
          id="donor-date"
          type="date"
          label={t("profile.lastDonation")}
          value={date}
          onChange={(e) => setDate(e.target.value)}
          disabled={never}
          inputProps={{ max: todayIso() }}
          error={Boolean(errors.date)}
          helperText={errors.date}
          fullWidth
        />
        <FormControlLabel
          control={<Checkbox checked={never} onChange={(e) => setNever(e.target.checked)} />}
          label={t("profile.never")}
        />
      </Stack>
      <Stack spacing={1}>
        <Typography sx={{ fontWeight: 500 }}>{t("profile.location")}</Typography>
        <Button
          variant="outlined"
          startIcon={<MyLocationRounded />}
          onClick={locate}
          disabled={locating}
        >
          {t("profile.useCurrent")}
        </Button>
        {locNote && (
          <Typography variant="body2" color="text.secondary">
            {locNote}
          </Typography>
        )}
      </Stack>
      <FormControlLabel
        control={<Switch checked={available} onChange={(e) => setAvailable(e.target.checked)} />}
        label={t("profile.available")}
      />
      <Box>
        <FormControlLabel
          control={<Checkbox checked={consent} onChange={(e) => setConsent(e.target.checked)} />}
          label={t("profile.consent")}
        />
        {errors.consent && (
          <Typography color="error" variant="body2">
            {errors.consent}
          </Typography>
        )}
      </Box>
      {errors.root && <Notice kind="error" title={errors.root} />}
      <SubmitButton busy={busy}>{t(donor ? "profile.save" : "profile.register")}</SubmitButton>
      {onCancel && (
        <Button onClick={onCancel} disabled={busy}>
          {t("actions.cancel", { ns: "common" })}
        </Button>
      )}
    </Stack>
  );
}

/** S-23 My donor profile (docs/03). */
export default function DonorProfilePage() {
  const { t } = useTranslation("blood");
  const localized = useLocalized();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving] = useState(false);
  const q = useQuery({
    queryKey: ["donor-me"],
    queryFn: donorsApi.me,
    retry: (n, err) => apiError(err).status !== 404 && n < 2,
  });
  const notDonor = q.isError && apiError(q.error).status === 404;
  useEffect(() => setEditing(false), [q.data?.id]);

  const setData = (d) => qc.setQueryData(["donor-me"], d);

  const toggle = async (available) => {
    const prev = q.data;
    setData({ ...prev, available });
    try {
      setData(await donorsApi.availability(available));
      toast(t(available ? "profile.visible" : "profile.hidden"));
    } catch (err) {
      setData(prev);
      toast(apiError(err).message, "error");
    }
  };

  const remove = async () => {
    setRemoving(true);
    try {
      await donorsApi.remove();
      qc.removeQueries({ queryKey: ["donor-me"] });
      await q.refetch();
      toast(t("profile.removed"));
    } catch (err) {
      toast(apiError(err).message, "error");
    } finally {
      setRemoving(false);
      setConfirmRemove(false);
    }
  };

  if (q.isLoading) return <ListSkeleton rows={4} />;
  if (q.isError && !notDonor)
    return <ErrorCard network={apiError(q.error).network} onRetry={() => q.refetch()} />;

  const d = q.data;
  return (
    <Stack spacing={2.5} sx={{ maxWidth: 560, mx: "auto" }}>
      <PageTitle sx={{ mb: 0 }}>{t("profile.title")}</PageTitle>
      {notDonor && (
        <>
          <Typography>{t("profile.intro")}</Typography>
          <DonorForm onSaved={setData} />
        </>
      )}
      {d && !notDonor && editing && (
        <DonorForm donor={d} onSaved={setData} onCancel={() => setEditing(false)} />
      )}
      {d && !notDonor && !editing && (
        <>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Box
                sx={{
                  minWidth: 64,
                  height: 64,
                  borderRadius: 2,
                  bgcolor: "#FDECEC",
                  color: "#C62828",
                  display: "grid",
                  placeItems: "center",
                  fontWeight: 700,
                  fontSize: "1.5rem",
                }}
              >
                {pretty(d.bloodGroup)}
              </Box>
              <Stack spacing={0.5}>
                <Typography sx={{ fontWeight: 700 }}>{d.displayName}</Typography>
                <Typography>
                  {d.eligibleNow
                    ? t("profile.eligibleNow")
                    : t("profile.eligibleFrom", { date: formatDate(d.eligibleFrom) })}
                </Typography>
                {d.village && (
                  <Typography variant="body2" color="text.secondary">
                    {localized(d.village)}
                  </Typography>
                )}
              </Stack>
            </Stack>
            <FormControlLabel
              sx={{ mt: 1.5 }}
              control={<Switch checked={d.available} onChange={(e) => toggle(e.target.checked)} />}
              label={t("profile.available")}
            />
            <Typography variant="body2" color="text.secondary">
              {t("profile.views", { n: d.viewsThisMonth })}
            </Typography>
          </Paper>
          <Button variant="outlined" onClick={() => setEditing(true)}>
            {t("profile.edit")}
          </Button>
          <Button color="error" onClick={() => setConfirmRemove(true)}>
            {t("profile.remove")}
          </Button>
        </>
      )}
      <ConfirmDialog
        open={confirmRemove}
        title={t("profile.removeTitle")}
        body={t("profile.removeBody")}
        confirmLabel={t("profile.remove")}
        cancelLabel={t("actions.cancel", { ns: "common" })}
        busy={removing}
        onCancel={() => setConfirmRemove(false)}
        onConfirm={remove}
      />
    </Stack>
  );
}
