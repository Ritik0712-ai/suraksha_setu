import { useState } from "react";
import {
  Box,
  Button,
  ButtonBase,
  Chip,
  FormControlLabel,
  Stack,
  Switch,
  Typography,
} from "@mui/material";
import {
  BloodtypeRounded,
  ChevronRightRounded,
  MyLocationRounded,
  PhoneRounded,
  SearchRounded,
  WhatsApp,
} from "@mui/icons-material";
import { useQuery } from "@tanstack/react-query";
import { Link as RouterLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import C from "../../config/constants.js";
import { apiError } from "../../api/client.js";
import { donorsApi } from "../../api/endpoints.js";
import { formatDistance, getPosition } from "../../lib/geo.js";
import { useLocalized } from "../../lib/localized.js";
import { timeAgo } from "../../lib/time.js";
import { FilterChips } from "../../components/ui/FilterChips.jsx";
import { Notice } from "../../components/ui/Notice.jsx";
import { PageTitle } from "../../components/ui/PageTitle.jsx";
import { ResponsiveDialog } from "../../components/ui/ResponsiveDialog.jsx";
import { SubmitButton } from "../../components/ui/fields.jsx";
import { ErrorCard, ListSkeleton } from "../../components/ui/States.jsx";

const RADII = [5, 10, 25, 50];
const pretty = (g) => g.replace("-", "−");

function DonorCard({ d, group, revealed, onReveal, error }) {
  const { t } = useTranslation("blood");
  const localized = useLocalized();
  const phone = revealed?.phone;
  const tenDigits = phone?.replace(/^\+91/, "");
  return (
    <Box
      sx={{
        p: 2,
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        bgcolor: "background.paper",
      }}
    >
      <Stack direction="row" spacing={2} alignItems="flex-start">
        <Box
          sx={{
            minWidth: 56,
            height: 56,
            borderRadius: 2,
            bgcolor: "#FDECEC",
            color: "#C62828",
            display: "grid",
            placeItems: "center",
            fontWeight: 700,
            fontSize: "1.25rem",
          }}
        >
          {pretty(d.bloodGroup)}
        </Box>
        <Stack spacing={0.25} sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography sx={{ fontWeight: 700 }}>{d.displayName}</Typography>
            {d.compatible && (
              <Chip size="small" color="success" variant="outlined" label={t("badgeCompatible")} />
            )}
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {[localized(d.village), formatDistance(t, d.distanceM)].filter(Boolean).join(" · ")}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {d.lastDonatedAt
              ? t("lastDonated", { ago: timeAgo(d.lastDonatedAt) })
              : t("neverDonated")}
          </Typography>
          <Typography sx={{ fontFamily: "monospace", fontSize: "1.0625rem", mt: 0.5 }}>
            {phone ? `+91 ${tenDigits}` : d.maskedPhone}
          </Typography>
        </Stack>
      </Stack>
      {error && (
        <Box sx={{ mt: 1.5 }}>
          <Notice kind="error" title={error} />
        </Box>
      )}
      <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
        {phone ? (
          <>
            <Button
              variant="contained"
              color="error"
              startIcon={<PhoneRounded />}
              href={`tel:${phone}`}
              sx={{ flex: 1 }}
            >
              {t("call")}
            </Button>
            <Button
              variant="outlined"
              startIcon={<WhatsApp />}
              href={`https://wa.me/91${tenDigits}?text=${encodeURIComponent(t("whatsappText", { group: pretty(group) }))}`}
              target="_blank"
              rel="noopener"
              sx={{ flex: 1 }}
            >
              {t("whatsapp")}
            </Button>
          </>
        ) : (
          <Button
            variant="contained"
            startIcon={<PhoneRounded />}
            onClick={() => onReveal(d)}
            fullWidth
          >
            {t("reveal")}
          </Button>
        )}
      </Stack>
    </Box>
  );
}

/** S-21 Blood donor search (docs/03). */
export default function BloodSearchPage() {
  const { t } = useTranslation("blood");
  const [group, setGroup] = useState(null);
  const [radiusKm, setRadius] = useState(25);
  const [includeCompatible, setCompatible] = useState(true);
  const [search, setSearch] = useState(null); // params of the last search
  const [position, setPosition] = useState(null);
  const [locStatus, setLocStatus] = useState("idle");
  const [confirm, setConfirm] = useState(null);
  const [revealed, setRevealed] = useState({});
  const [revealError, setRevealError] = useState({});
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState(null);

  const me = useQuery({ queryKey: ["donor-me"], queryFn: donorsApi.me, retry: false });
  const isDonor = me.isSuccess;

  const results = useQuery({
    queryKey: ["donor-search", search],
    queryFn: () => donorsApi.search(search),
    enabled: Boolean(search),
  });

  const locate = async () => {
    setLocStatus("locating");
    try {
      setPosition(await getPosition());
      setLocStatus("ok");
    } catch {
      setLocStatus("denied");
    }
  };

  const run = (radius = radiusKm) => {
    if (!group) return;
    setRadius(radius);
    setRevealed({});
    setSearch({
      bloodGroup: group,
      radiusKm: radius,
      includeCompatible,
      ...(position ? { lat: position.lat, lng: position.lng } : {}),
    });
  };

  const reveal = async () => {
    const d = confirm;
    setBusy(true);
    try {
      const res = await donorsApi.reveal(d.id, search.bloodGroup);
      setRevealed((r) => ({ ...r, [d.id]: res }));
      setLeft(res.revealsLeftToday);
    } catch (err) {
      const e = apiError(err);
      setRevealError((r) => ({
        ...r,
        [d.id]: e.network ? t("states.networkError", { ns: "common" }) : e.message,
      }));
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const donors = results.data?.donors ?? [];
  const others = group
    ? C.bloodCompatibility[group]
        .filter((g) => g !== group)
        .map(pretty)
        .join(", ")
    : "";

  return (
    <Stack spacing={2.5}>
      <PageTitle sx={{ mb: 0 }}>{t("title")}</PageTitle>
      <ButtonBase
        component={RouterLink}
        to="/blood/donor"
        sx={{
          justifyContent: "space-between",
          p: 2,
          borderRadius: 2,
          border: "1px solid",
          borderColor: "divider",
          bgcolor: "#FDECEC",
          color: "#C62828",
          fontWeight: 500,
          fontSize: "1rem",
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <BloodtypeRounded />
          <span>{t(isDonor ? "donorCard.manage" : "donorCard.register")}</span>
        </Stack>
        <ChevronRightRounded />
      </ButtonBase>

      <Box>
        <Typography id="group-label" sx={{ fontWeight: 500, mb: 1 }}>
          {t("groupLabel")}
        </Typography>
        <Box
          role="radiogroup"
          aria-labelledby="group-label"
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
      </Box>

      <Box>
        <Typography sx={{ fontWeight: 500, mb: 1 }}>{t("distanceLabel")}</Typography>
        <FilterChips
          label={t("distanceLabel")}
          value={radiusKm}
          onChange={setRadius}
          options={RADII.map((n) => ({ value: n, label: t("km", { n }) }))}
        />
      </Box>

      <Box>
        <FormControlLabel
          control={
            <Switch checked={includeCompatible} onChange={(e) => setCompatible(e.target.checked)} />
          }
          label={t("compatible")}
        />
        {group && others && (
          <Typography variant="body2" color="text.secondary">
            {t("compatibleHint", { group: pretty(group), others })}
          </Typography>
        )}
      </Box>

      {!position && locStatus !== "denied" && (
        <Notice
          title={t("location.allowTitle")}
          action={
            <Button
              variant="outlined"
              startIcon={<MyLocationRounded />}
              onClick={locate}
              disabled={locStatus === "locating"}
            >
              {t("location.allow")}
            </Button>
          }
        />
      )}
      {locStatus === "denied" && <Notice kind="warning">{t("location.village")}</Notice>}

      <Button
        variant="contained"
        size="large"
        startIcon={<SearchRounded />}
        onClick={() => run()}
        disabled={!group}
      >
        {t("search")}
      </Button>

      {results.isLoading && <ListSkeleton />}
      {results.isError && (
        <ErrorCard network={apiError(results.error).network} onRetry={() => results.refetch()} />
      )}
      {results.isSuccess && (
        <Typography sx={{ fontWeight: 700 }} aria-live="polite">
          {t("found", { count: donors.length })}
        </Typography>
      )}
      {left !== null && (
        <Typography variant="body2" color="text.secondary">
          {t("revealsLeft", { n: left })}
        </Typography>
      )}
      {results.isSuccess && donors.length === 0 && (
        <Notice
          kind="warning"
          title={t("empty", { km: search.radiusKm })}
          action={
            <Stack spacing={1} alignItems="flex-start">
              {search.radiusKm < 50 && (
                <Button variant="outlined" onClick={() => run(50)}>
                  {t("wider")}
                </Button>
              )}
              <Button variant="contained" color="error" href="tel:108">
                {t("call108")}
              </Button>
              <Typography variant="body2">{t("emptyTip")}</Typography>
            </Stack>
          }
        />
      )}
      <Stack component="ul" spacing={1.5} sx={{ listStyle: "none", p: 0, m: 0 }}>
        {donors.map((d) => (
          <li key={d.id}>
            <DonorCard
              d={d}
              group={search.bloodGroup}
              revealed={revealed[d.id]}
              error={revealError[d.id]}
              onReveal={setConfirm}
            />
          </li>
        ))}
      </Stack>

      <ResponsiveDialog
        open={Boolean(confirm)}
        onClose={busy ? undefined : () => setConfirm(null)}
        title={t("revealTitle")}
        labelId="reveal-title"
        actions={
          <>
            <Button variant="outlined" onClick={() => setConfirm(null)} disabled={busy}>
              {t("actions.cancel", { ns: "common" })}
            </Button>
            <SubmitButton type="button" busy={busy} onClick={reveal}>
              {t("continue")}
            </SubmitButton>
          </>
        }
      >
        <Typography>{t("revealBody")}</Typography>
      </ResponsiveDialog>
    </Stack>
  );
}
