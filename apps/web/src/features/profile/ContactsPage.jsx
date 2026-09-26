import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  AddRounded,
  CheckRounded,
  ContactPhoneRounded,
  ContactsRounded,
  MoreVertRounded,
  SmsRounded,
} from "@mui/icons-material";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link as RouterLink, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import C from "../../config/constants.js";
import { apiError } from "../../api/client.js";
import { usersApi } from "../../api/endpoints.js";
import { cleanPhoneInput, formatPhone, toTenDigits } from "../../lib/phone.js";
import { STORAGE_KEYS, writeJSON } from "../../lib/storage.js";
import { useSession } from "../../stores/session.js";
import { toast } from "../../stores/toast.js";
import { Notice } from "../../components/ui/Notice.jsx";
import { PageTitle } from "../../components/ui/PageTitle.jsx";
import { ConfirmDialog, ResponsiveDialog } from "../../components/ui/ResponsiveDialog.jsx";
import { EmptyState, ErrorCard, ListSkeleton } from "../../components/ui/States.jsx";
import { PhoneField, SubmitButton } from "../../components/ui/fields.jsx";
import { useFieldError } from "../../components/ui/useFieldError.js";
import { applyServerErrors, optionalEmail, phoneRule } from "../auth/schemas.js";
import { reloadMe } from "../auth/session.js";

const contactSchema = z.object({
  name: z.string().trim().min(1, "required").max(60, "too_long"),
  relation: z.enum(C.contactRelations, { errorMap: () => ({ message: "required" }) }),
  phone: phoneRule,
  email: optionalEmail,
});

const pickerSupported = () =>
  typeof navigator !== "undefined" && "contacts" in navigator && "ContactsManager" in window;

/** Add / edit form in a bottom sheet (mobile) or dialog (desktop). */
function ContactForm({ open, contact, contacts, onClose }) {
  const { t } = useTranslation("contacts");
  const fieldError = useFieldError();
  const qc = useQueryClient();
  const ownPhone = useSession((s) => s.user?.phone);
  const {
    control,
    register,
    handleSubmit,
    setError,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(contactSchema) });

  useEffect(() => {
    if (!open) return;
    reset(
      contact
        ? {
            name: contact.name,
            relation: contact.relation,
            phone: contact.phone.replace(/^\+91/, ""),
            email: contact.email ?? "",
          }
        : { name: "", relation: undefined, phone: "", email: "" },
    );
  }, [open, contact, reset]);

  const pick = async () => {
    try {
      const [c] = await navigator.contacts.select(["name", "tel"], { multiple: false });
      if (c?.name?.[0]) setValue("name", c.name[0]);
      if (c?.tel?.[0]) setValue("phone", cleanPhoneInput(c.tel[0]));
    } catch {
      // The user closed the picker.
    }
  };

  const onSubmit = async (v) => {
    const phone = `+91${toTenDigits(v.phone)}`;
    // Instant checks before the round trip (the server checks again).
    if (phone === ownPhone) return setError("phone", { message: "own_number" });
    if (contacts.some((c) => c.phone === phone && c.id !== contact?.id))
      return setError("phone", { message: "duplicate" });
    const body = { name: v.name, relation: v.relation, phone, email: v.email || null };
    try {
      if (contact) await usersApi.updateContact(contact.id, body);
      else await usersApi.addContact(body);
      await qc.invalidateQueries({ queryKey: ["contacts"] });
      reloadMe().catch(() => {});
      toast(t("toast.saved", { ns: "common" }));
      onClose();
    } catch (err) {
      const e = apiError(err);
      if (!applyServerErrors(e, setError))
        setError("root", {
          message: e.network ? t("states.networkError", { ns: "common" }) : e.message,
        });
    }
  };

  return (
    <ResponsiveDialog
      open={open}
      onClose={onClose}
      title={t(contact ? "formEdit" : "formAdd")}
      labelId="contact-form-title"
    >
      <Stack component="form" noValidate spacing={2.5} onSubmit={handleSubmit(onSubmit)}>
        {pickerSupported() && (
          <Button variant="outlined" startIcon={<ContactsRounded />} onClick={pick}>
            {t("pick")}
          </Button>
        )}
        <TextField
          {...register("name")}
          id="contact-name"
          label={t("name")}
          autoComplete="off"
          fullWidth
          error={Boolean(errors.name)}
          helperText={fieldError(errors.name)}
        />
        <Controller
          name="relation"
          control={control}
          render={({ field }) => (
            <Box role="radiogroup" aria-labelledby="relation-label">
              <Typography id="relation-label" sx={{ mb: 1, fontWeight: 500 }}>
                {t("relation")}
              </Typography>
              <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1}>
                {C.contactRelations.map((r) => {
                  const selected = field.value === r;
                  return (
                    <Chip
                      key={r}
                      role="radio"
                      aria-checked={selected}
                      label={t(`relations.${r}`, { ns: "common" })}
                      icon={
                        selected ? <CheckRounded sx={{ color: "#fff !important" }} /> : undefined
                      }
                      color={selected ? "primary" : "default"}
                      variant={selected ? "filled" : "outlined"}
                      onClick={() => field.onChange(r)}
                      sx={{ borderColor: selected ? undefined : "#7A8699" }}
                    />
                  );
                })}
              </Stack>
              {errors.relation && (
                <Typography variant="body2" color="error" sx={{ mt: 1 }}>
                  {fieldError(errors.relation)}
                </Typography>
              )}
            </Box>
          )}
        />
        <Controller
          name="phone"
          control={control}
          render={({ field }) => (
            <PhoneField
              {...field}
              id="contact-phone"
              label={t("mobile")}
              autoComplete="off"
              error={Boolean(errors.phone)}
              helperText={fieldError(errors.phone)}
            />
          )}
        />
        <TextField
          {...register("email")}
          id="contact-email"
          type="email"
          label={t("email")}
          fullWidth
          error={Boolean(errors.email)}
          helperText={fieldError(errors.email) ?? t("emailHelp")}
        />
        {errors.root && <Notice kind="error">{errors.root.message}</Notice>}
        <SubmitButton busy={isSubmitting}>{t("actions.save", { ns: "common" })}</SubmitButton>
      </Stack>
    </ResponsiveDialog>
  );
}

function ContactCard({ contact, onEdit, onDelete }) {
  const { t } = useTranslation("contacts");
  const [anchor, setAnchor] = useState(null);
  // A test SMS from the user's own phone helps the contact recognise real alerts. No server call.
  const testHref = `sms:${contact.phone}?body=${encodeURIComponent(t("testMessage", { name: useSession.getState().user?.name ?? "" }))}`;
  return (
    <Paper variant="outlined" component="li" sx={{ p: 2, borderRadius: 2, listStyle: "none" }}>
      <Stack direction="row" spacing={1} alignItems="flex-start">
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h3" component="p">
            {contact.name}
          </Typography>
          <Typography color="text.secondary">
            {t(`relations.${contact.relation}`, { ns: "common" })}
          </Typography>
          <Typography>{formatPhone(contact.phone)}</Typography>
          {contact.email && (
            <Typography color="text.secondary" sx={{ wordBreak: "break-all" }}>
              {contact.email}
            </Typography>
          )}
          <Button
            component="a"
            href={testHref}
            startIcon={<SmsRounded />}
            size="small"
            sx={{ mt: 1, ml: -1 }}
          >
            {t("test")}
          </Button>
        </Box>
        <IconButton
          aria-label={t("actionsFor", { name: contact.name })}
          onClick={(e) => setAnchor(e.currentTarget)}
          sx={{ width: 48, height: 48 }}
        >
          <MoreVertRounded />
        </IconButton>
        <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
          <MenuItem
            onClick={() => {
              setAnchor(null);
              onEdit(contact);
            }}
            sx={{ minHeight: 48 }}
          >
            {t("actions.edit", { ns: "common" })}
          </MenuItem>
          <MenuItem
            onClick={() => {
              setAnchor(null);
              onDelete(contact);
            }}
            sx={{ minHeight: 48, color: "error.main" }}
          >
            {t("actions.delete", { ns: "common" })}
          </MenuItem>
        </Menu>
      </Stack>
    </Paper>
  );
}

/** S-28 Emergency contacts (docs/03). Contacts are cached on the device for offline SOS. */
export default function ContactsPage() {
  const { t } = useTranslation("contacts");
  const [params] = useSearchParams();
  const onboarding = params.get("onboarding") === "1";
  const qc = useQueryClient();
  const [form, setForm] = useState({ open: false, contact: null });
  const [toDelete, setToDelete] = useState(null);

  const contacts = useQuery({ queryKey: ["contacts"], queryFn: usersApi.contacts });
  useEffect(() => {
    if (contacts.data) writeJSON(STORAGE_KEYS.contacts, contacts.data);
  }, [contacts.data]);

  const remove = useMutation({
    mutationFn: (id) => usersApi.removeContact(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["contacts"] });
      reloadMe().catch(() => {});
      toast(t("toast.deleted", { ns: "common" }));
      setToDelete(null);
    },
  });

  const list = contacts.data ?? [];
  const full = list.length >= C.maxEmergencyContacts;
  const addButton = (
    <Stack spacing={0.5} alignItems="flex-start">
      <Button
        variant="contained"
        startIcon={<AddRounded />}
        disabled={full}
        onClick={() => setForm({ open: true, contact: null })}
      >
        {t("add")}
      </Button>
      {full && (
        <Typography variant="body2" color="text.secondary">
          {t("max")}
        </Typography>
      )}
    </Stack>
  );

  return (
    <Stack spacing={2.5} sx={{ maxWidth: 760 }}>
      {onboarding ? (
        <Box>
          <Typography variant="h1">{t("onboardingTitle")}</Typography>
          <Button component={RouterLink} to="/" variant="text" sx={{ mt: 1, ml: -1 }}>
            {t("skip")}
          </Button>
        </Box>
      ) : (
        <PageTitle>{t("title")}</PageTitle>
      )}
      <Typography>{t("intro")}</Typography>

      {contacts.isLoading && <ListSkeleton rows={2} onRetry={() => contacts.refetch()} />}
      {contacts.isError && (
        <ErrorCard network={!contacts.error?.response} onRetry={() => contacts.refetch()} />
      )}
      {contacts.isSuccess && list.length === 0 && (
        <EmptyState
          icon={ContactPhoneRounded}
          title={t("emptyTitle")}
          body={t("emptyBody")}
          action={addButton}
        />
      )}
      {list.length > 0 && (
        <>
          <Stack component="ul" spacing={1.5} sx={{ p: 0, m: 0 }}>
            {list.map((c) => (
              <ContactCard
                key={c.id}
                contact={c}
                onEdit={(contact) => setForm({ open: true, contact })}
                onDelete={setToDelete}
              />
            ))}
          </Stack>
          {addButton}
        </>
      )}
      {onboarding && list.length > 0 && (
        <Button component={RouterLink} to="/" variant="contained" color="success">
          {t("actions.continue", { ns: "common" })}
        </Button>
      )}

      <ContactForm
        open={form.open}
        contact={form.contact}
        contacts={list}
        onClose={() => setForm({ open: false, contact: null })}
      />
      <ConfirmDialog
        open={Boolean(toDelete)}
        title={t("deleteTitle", { name: toDelete?.name ?? "" })}
        body={t("deleteBody")}
        confirmLabel={t("actions.delete", { ns: "common" })}
        cancelLabel={t("actions.cancel", { ns: "common" })}
        onConfirm={() => remove.mutate(toDelete.id)}
        onCancel={() => setToDelete(null)}
        busy={remove.isPending}
      />
    </Stack>
  );
}
