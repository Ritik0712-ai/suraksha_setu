import { useState } from "react";
import { Avatar, Box, ButtonBase, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import { CloseRounded } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { forgetAccount, knownAccounts } from "../../lib/knownAccounts.js";
import { maskPhone } from "../../lib/phone.js";

/**
 * "Who is using the phone?" — people who logged in on this phone before. Tapping a name fills
 * the mobile number; they still type their own password. ✕ removes a name from this phone.
 */
export function WhoIsUsing({ selected, onPick }) {
  const { t } = useTranslation("auth");
  const [accounts, setAccounts] = useState(knownAccounts);
  if (!accounts.length) return null;

  const remove = (a) => {
    forgetAccount(a.phone);
    setAccounts(knownAccounts());
    if (selected === a.phone) onPick(null);
  };

  return (
    <Box component="section" aria-labelledby="who-heading">
      <Typography id="who-heading" sx={{ fontWeight: 700, mb: 1 }}>
        {t("who.title")}
      </Typography>
      <Stack spacing={1} component="ul" sx={{ listStyle: "none", p: 0, m: 0 }}>
        {accounts.map((a) => {
          const on = selected === a.phone;
          return (
            <Stack component="li" key={a.phone} direction="row" alignItems="center" spacing={0.5}>
              <ButtonBase
                onClick={() => onPick(a.phone)}
                aria-pressed={on}
                sx={{
                  flex: 1,
                  justifyContent: "flex-start",
                  gap: 1.5,
                  p: 1.25,
                  borderRadius: 2,
                  border: "2px solid",
                  borderColor: on ? "primary.main" : "divider",
                  bgcolor: on ? "#E8EEF6" : "background.paper",
                  textAlign: "left",
                  minHeight: 56,
                  "&:focus-visible": { outline: "3px solid #C2410C", outlineOffset: 2 },
                }}
              >
                <Avatar sx={{ bgcolor: "primary.main", width: 36, height: 36 }} aria-hidden>
                  {a.name.trim().charAt(0).toUpperCase()}
                </Avatar>
                <Box>
                  <Typography sx={{ fontWeight: 500 }}>{a.name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {maskPhone(`+91${a.phone}`)}
                  </Typography>
                </Box>
              </ButtonBase>
              <Tooltip title={t("who.remove", { name: a.name })}>
                <IconButton
                  aria-label={t("who.remove", { name: a.name })}
                  onClick={() => remove(a)}
                >
                  <CloseRounded />
                </IconButton>
              </Tooltip>
            </Stack>
          );
        })}
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        {t("who.hint")}
      </Typography>
    </Box>
  );
}
