import { Button, Stack, Typography } from "@mui/material";
import { SmsRounded, VerifiedUserRounded } from "@mui/icons-material";
import { useQuery } from "@tanstack/react-query";
import { Link as RouterLink, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { sosApi } from "../../api/endpoints.js";
import { openExternal, smsHref } from "../../lib/device.js";
import { useSession } from "../../stores/session.js";
import { ListSkeleton } from "../../components/ui/States.jsx";

/** S-08 SOS ended (docs/03). Contacts reached only by SMS get a "safe" SMS from the phone. */
export default function SosDonePage() {
  const { t } = useTranslation("sos");
  const { id } = useParams();
  const name = useSession((s) => s.user?.name ?? "");
  const { data: sos, isLoading } = useQuery({
    queryKey: ["sos", id],
    queryFn: () => sosApi.get(id),
  });
  if (isLoading) return <ListSkeleton />;

  // Emailed contacts get the "safe" email automatically; the rest only heard by SMS from the
  // user's own phone, so offer to send them an SMS back.
  const recipients = (sos?.contacts ?? []).filter((c) => !c.emailed).map((c) => c.phone);
  const needsSms = recipients.length > 0;

  return (
    <Stack
      spacing={3}
      alignItems="center"
      textAlign="center"
      sx={{ py: 4, maxWidth: 520, mx: "auto" }}
    >
      <VerifiedUserRounded color="success" sx={{ fontSize: 96 }} />
      <Typography variant="h1">{t("done.title")}</Typography>
      {needsSms ? (
        <>
          <Typography>{t("done.tellContacts")}</Typography>
          <Button
            variant="contained"
            startIcon={<SmsRounded />}
            onClick={() => openExternal(smsHref(recipients, t("done.safeSms", { name })))}
          >
            {t("done.sendSms")}
          </Button>
        </>
      ) : (
        sos?.contacts.length > 0 && <Typography>{t("done.contactsTold")}</Typography>
      )}
      <Button variant={needsSms ? "outlined" : "contained"} component={RouterLink} to="/" fullWidth>
        {t("actions.goHome", { ns: "common" })}
      </Button>
      {sos?.status === "FALSE_ALARM" && (
        <Typography color="text.secondary">{t("done.falseAlarm")}</Typography>
      )}
    </Stack>
  );
}
