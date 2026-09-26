import {
  Box,
  Button,
  Chip,
  Link,
  List,
  ListItem,
  ListItemText,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { AssignmentRounded, CheckCircleRounded, ScheduleRounded } from "@mui/icons-material";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { apiError } from "../../api/client.js";
import { adminApi } from "../../api/endpoints.js";
import { useLocalized } from "../../lib/localized.js";
import { useSocketEvent } from "../../lib/socket.js";
import { sosChipStatus } from "../../lib/sosStatus.js";
import { formatDate, timeAgo } from "../../lib/time.js";
import { useSession } from "../../stores/session.js";
import { EmergencyIcon } from "../../components/icons/index.jsx";
import { ErrorCard, ListSkeleton } from "../../components/ui/States.jsx";
import { StatusChip } from "../../components/ui/StatusChip.jsx";
import { KpiCard, Section } from "./ui.jsx";

/** A-01 Overview (docs/03). Refreshes live on new SOS / complaints. */
export default function OverviewPage() {
  const { t } = useTranslation("portal");
  const localized = useLocalized();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const user = useSession((s) => s.user);
  const q = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: adminApi.overview,
    refetchInterval: 60_000,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "overview"] });
  useSocketEvent("sos:new", refresh);
  useSocketEvent("sos:updated", refresh);
  useSocketEvent("complaint:new", refresh);
  useSocketEvent("complaint:updated", refresh);
  useSocketEvent("socket:reconnected", refresh);

  if (q.isLoading) return <ListSkeleton rows={4} />;
  if (q.isError)
    return <ErrorCard network={apiError(q.error).network} onRetry={() => q.refetch()} />;
  const d = q.data;
  const area = d.scope ? d.scope.map(localized).join(", ") : t("common.allAreas");

  const activityText = (a) => {
    const no = a.complaintNo;
    const status = a.status ? t(`status.${a.status}`, { ns: "common" }) : "";
    if (a.kind === "complaint_status" && a.actorName)
      return t("overview.events.complaint_status_by", { no, status, actor: a.actorName });
    return t(`overview.events.${a.kind}`, { no, status, village: localized(a.village) || "—" });
  };

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h1">{t("overview.greeting", { name: user?.name ?? "" })}</Typography>
        <Typography color="text.secondary">
          {area} · {t("overview.today", { date: formatDate(new Date()) })}
        </Typography>
      </Box>

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr 1fr", lg: "repeat(4, 1fr)" },
        }}
      >
        <KpiCard
          label={t("overview.kpi.open")}
          value={d.kpis.openComplaints}
          icon={AssignmentRounded}
          onClick={() =>
            navigate("/portal/complaints?status=SUBMITTED,VERIFIED,ASSIGNED,IN_PROGRESS")
          }
        />
        <KpiCard
          label={t("overview.kpi.resolvedWeek")}
          value={d.kpis.resolvedThisWeek}
          icon={CheckCircleRounded}
        />
        <KpiCard
          label={t("overview.kpi.activeSos")}
          value={d.kpis.activeSos}
          icon={EmergencyIcon}
          alert={d.kpis.activeSos > 0}
          onClick={() => navigate("/portal/sos")}
        />
        <KpiCard
          label={t("overview.kpi.avgResolution")}
          value={
            d.kpis.avgResolutionDays === null
              ? "—"
              : t("overview.kpi.avgDays", { n: d.kpis.avgResolutionDays })
          }
          hint={t("overview.kpi.last30")}
          icon={ScheduleRounded}
        />
      </Box>

      <Section title={t("overview.activeSos")}>
        {d.activeSos.length === 0 ? (
          <Typography color="text.secondary">{t("overview.noSos")}</Typography>
        ) : (
          <Stack direction="row" spacing={1.5} sx={{ overflowX: "auto", pb: 1 }}>
            {d.activeSos.map((s) => (
              <Box
                key={s.id}
                sx={{
                  minWidth: 220,
                  p: 1.5,
                  borderRadius: 2,
                  border: "2px solid",
                  borderColor: "error.main",
                  bgcolor: "#FDECEC",
                }}
              >
                <Typography sx={{ fontWeight: 700 }}>{s.name}</Typography>
                <Typography variant="body2">{localized(s.village)}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {t("overview.startedAgo", { ago: timeAgo(s.triggeredAt) })}
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                  <StatusChip status={sosChipStatus(s.status)} size="small" />
                  <Button
                    size="small"
                    variant="contained"
                    color="error"
                    component={RouterLink}
                    to={`/portal/sos/${s.id}`}
                  >
                    {t("common.view")}
                  </Button>
                </Stack>
              </Box>
            ))}
          </Stack>
        )}
      </Section>

      <Box sx={{ display: "grid", gap: 3, gridTemplateColumns: { xs: "1fr", lg: "3fr 2fr" } }}>
        <Section title={t("overview.needsAction")}>
          {d.needsAction.length === 0 ? (
            <Typography color="text.secondary">{t("overview.noWaiting")}</Typography>
          ) : (
            <Box sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t("overview.cols.number")}</TableCell>
                    <TableCell>{t("overview.cols.category")}</TableCell>
                    <TableCell>{t("overview.cols.village")}</TableCell>
                    <TableCell align="right">{t("overview.cols.age")}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {d.needsAction.map((c) => (
                    <TableRow key={c.id} hover>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>{c.complaintNo}</TableCell>
                      <TableCell>{t(`categories.${c.category}`, { ns: "complaints" })}</TableCell>
                      <TableCell>{localized(c.village)}</TableCell>
                      <TableCell align="right">
                        <Chip
                          size="small"
                          label={t("common.days", { n: c.ageDays })}
                          color={c.ageDays > 7 ? "error" : "default"}
                          variant={c.ageDays > 7 ? "filled" : "outlined"}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Link
                          component={RouterLink}
                          to={`/portal/complaints/${c.id}`}
                          sx={{ fontWeight: 500 }}
                        >
                          {t("common.open")}
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
        </Section>
        <Section title={t("overview.activity")}>
          {d.activity.length === 0 ? (
            <Typography color="text.secondary">{t("overview.noActivity")}</Typography>
          ) : (
            <List dense disablePadding>
              {d.activity.map((a, i) => (
                <ListItem key={i} disableGutters divider={i < d.activity.length - 1}>
                  <ListItemText
                    primary={activityText(a)}
                    secondary={timeAgo(a.at)}
                    primaryTypographyProps={{ fontSize: "0.95rem" }}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </Section>
      </Box>
    </Stack>
  );
}
