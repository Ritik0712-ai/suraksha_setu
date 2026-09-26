import { useState } from "react";
import { Box, Button, Divider, Stack, TextField, Typography } from "@mui/material";
import {
  CheckCircleRounded,
  ContactPhoneRounded,
  LocalHospitalRounded,
  PhotoCameraRounded,
  VolunteerActivismRounded,
} from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { HandpumpIcon, LogoMark, SahayakIcon } from "../../components/icons/index.jsx";
import { FilterChips } from "../../components/ui/FilterChips.jsx";
import { HelplinesGrid } from "../../components/ui/HelplinesGrid.jsx";
import { ModuleTile } from "../../components/ui/ModuleTile.jsx";
import { HighlightCard, Notice } from "../../components/ui/Notice.jsx";
import { ConfirmDialog, ResponsiveDialog } from "../../components/ui/ResponsiveDialog.jsx";
import { SosButton } from "../../components/ui/SosButton.jsx";
import { EmptyState, ErrorCard, ListSkeleton } from "../../components/ui/States.jsx";
import { StatusChip } from "../../components/ui/StatusChip.jsx";
import { WizardFrame } from "../../components/ui/WizardFrame.jsx";
import { PasswordField, PhoneField, SubmitButton } from "../../components/ui/fields.jsx";
import { toast } from "../../stores/toast.js";

// Dev-only gallery (doc 06 Phase 3 deliverable): every shared component, in the current
// language — switch with the header toggle. Section names are component names, not UI copy.
function Group({ name, children }) {
  return (
    <Box component="section" sx={{ py: 3 }}>
      <Typography variant="h2" sx={{ mb: 2, fontFamily: "monospace" }}>
        {name}
      </Typography>
      {children}
      <Divider sx={{ mt: 3 }} />
    </Box>
  );
}

export default function ComponentsPage() {
  const { t } = useTranslation();
  const [chip, setChip] = useState("all");
  const [dialog, setDialog] = useState(null);
  const [phone, setPhone] = useState("");

  return (
    <Box>
      <Typography variant="h1">/dev/components</Typography>

      <Group name="Buttons (docs/04 §6.1)">
        <Stack direction="row" flexWrap="wrap" useFlexGap spacing={2} alignItems="center">
          <Button variant="contained">{t("actions.save")}</Button>
          <Button variant="outlined" sx={{ borderWidth: 2 }}>
            {t("actions.cancel")}
          </Button>
          <Button variant="contained" color="secondary">
            {t("modules.check")}
          </Button>
          <Button variant="contained" color="success" startIcon={<CheckCircleRounded />}>
            {t("status.SOS_RESOLVED")}
          </Button>
          <Button variant="text">{t("actions.edit")}</Button>
          <Button variant="text" color="error">
            {t("actions.delete")}
          </Button>
          <Button variant="contained" disabled>
            {t("states.needsInternet")}
          </Button>
          <Box sx={{ width: 200 }}>
            <SubmitButton busy>{t("actions.save")}</SubmitButton>
          </Box>
        </Stack>
        <Stack direction="row" spacing={3} alignItems="center" sx={{ mt: 3 }}>
          <SosButton size={200} />
          <SosButton size={64} />
        </Stack>
      </Group>

      <Group name="ModuleTile">
        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
          }}
        >
          <ModuleTile icon={PhotoCameraRounded} label={t("modules.report")} to="#" />
          <ModuleTile
            icon={VolunteerActivismRounded}
            label={t("modules.schemes")}
            tint="saffron"
            to="#"
          />
          <ModuleTile icon={LocalHospitalRounded} label={t("modules.emergency")} to="#" />
          <ModuleTile icon={SahayakIcon} label={t("modules.sahayak")} to="#" />
        </Box>
      </Group>

      <Group name="StatusChip (docs/04 §3.3)">
        <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1}>
          {[
            "SUBMITTED",
            "VERIFIED",
            "ASSIGNED",
            "IN_PROGRESS",
            "RESOLVED",
            "REJECTED",
            "SOS_ACTIVE",
            "SOS_ACKNOWLEDGED",
            "SOS_RESOLVED",
          ].map((s) => (
            <StatusChip key={s} status={s} />
          ))}
        </Stack>
      </Group>

      <Group name="FilterChips">
        <FilterChips
          label="filter"
          value={chip}
          onChange={setChip}
          scroll
          options={["all", "SUBMITTED", "IN_PROGRESS", "RESOLVED", "REJECTED"].map((v) => ({
            value: v,
            label: v === "all" ? "All / सभी" : t(`status.${v}`),
          }))}
        />
      </Group>

      <Group name="Notice / HighlightCard">
        <Stack spacing={1.5}>
          <Notice kind="info" title={t("comingSoon.title")}>
            {t("comingSoon.body")}
          </Notice>
          <Notice kind="warning" title={t("offline.banner")} />
          <Notice kind="error">{t("states.serverError")}</Notice>
          <Notice kind="success">{t("toast.saved")}</Notice>
          <HighlightCard>
            <Typography>{t("tagline")}</Typography>
          </HighlightCard>
        </Stack>
      </Group>

      <Group name="EmptyState / ErrorCard / ListSkeleton">
        <EmptyState
          icon={ContactPhoneRounded}
          title={t("comingSoon.title")}
          body={t("comingSoon.body")}
          action={<Button variant="contained">{t("actions.continue")}</Button>}
        />
        <Stack spacing={2}>
          <ErrorCard network onRetry={() => {}} />
          <ErrorCard onRetry={() => {}} />
          <ListSkeleton rows={2} />
        </Stack>
      </Group>

      <Group name="Fields">
        <Stack spacing={2.5} sx={{ maxWidth: 420 }}>
          <TextField label={t("footer.about")} helperText={t("errors.required")} fullWidth />
          <TextField
            label={t("footer.about")}
            error
            helperText={t("errors.invalid_name")}
            fullWidth
          />
          <PhoneField value={phone} onChange={setPhone} label="+91" />
          <PasswordField label={t("actions.showPassword")} />
        </Stack>
      </Group>

      <Group name="Toast / ResponsiveDialog / ConfirmDialog">
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
          <Button variant="outlined" onClick={() => toast(t("toast.saved"))}>
            Toast
          </Button>
          <Button variant="outlined" onClick={() => setDialog("sheet")}>
            ResponsiveDialog
          </Button>
          <Button variant="outlined" onClick={() => setDialog("confirm")}>
            ConfirmDialog
          </Button>
        </Stack>
        <ResponsiveDialog
          open={dialog === "sheet"}
          onClose={() => setDialog(null)}
          title={t("comingSoon.title")}
          actions={
            <Button variant="contained" onClick={() => setDialog(null)}>
              {t("actions.close")}
            </Button>
          }
        >
          {t("comingSoon.body")}
        </ResponsiveDialog>
        <ConfirmDialog
          open={dialog === "confirm"}
          title={t("dialog.confirmTitle")}
          body={t("comingSoon.body")}
          confirmLabel={t("actions.delete")}
          cancelLabel={t("actions.cancel")}
          onConfirm={() => setDialog(null)}
          onCancel={() => setDialog(null)}
        />
      </Group>

      <Group name="WizardFrame">
        <Box sx={{ border: "1px dashed", borderColor: "divider", borderRadius: 2, p: 2 }}>
          <WizardFrame
            title={t("modules.report")}
            step={2}
            total={4}
            onBack={() => {}}
            footer={
              <Button variant="contained" fullWidth>
                {t("actions.next")}
              </Button>
            }
          >
            <Typography>{t("comingSoon.body")}</Typography>
          </WizardFrame>
        </Box>
      </Group>

      <Group name="HelplinesGrid">
        <HelplinesGrid />
      </Group>

      <Group name="Icons (docs/04 §6.11, §6.13)">
        <Stack direction="row" spacing={3} alignItems="center">
          <LogoMark size={64} />
          <LogoMark size={32} />
          <HandpumpIcon sx={{ fontSize: 48 }} color="primary" />
          <SahayakIcon sx={{ fontSize: 48 }} color="secondary" />
        </Stack>
      </Group>
    </Box>
  );
}
