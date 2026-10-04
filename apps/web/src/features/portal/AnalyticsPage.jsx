import { useState } from "react";
import {
  Box,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { DownloadRounded } from "@mui/icons-material";
import { BarChart } from "@mui/x-charts/BarChart";
import { LineChart } from "@mui/x-charts/LineChart";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiError } from "../../api/client.js";
import { adminApi } from "../../api/endpoints.js";
import { downloadBlob, toCsv, useLocalized } from "../../lib/localized.js";
import { FilterChips } from "../../components/ui/FilterChips.jsx";
import { PageTitle } from "../../components/ui/PageTitle.jsx";
import { ErrorCard, ListSkeleton } from "../../components/ui/States.jsx";
import { Section } from "./ui.jsx";

const NAVY = "#003366";
const SAFFRON = "#C2410C";
const iso = (d) => d.toISOString().slice(0, 10);
// Always start at 0 and never collapse to a zero-height axis (all-zero data draws "000000").
const yFrom = (values) => [{ min: 0, max: Math.max(1, ...values), tickMinStep: 1 }];
const daysAgo = (n) => iso(new Date(Date.now() - (n - 1) * 86400_000));

function Chart({ title, rows, header, filename, children, empty }) {
  const { t } = useTranslation("portal");
  const download = () =>
    downloadBlob(new Blob([toCsv([header, ...rows])], { type: "text/csv" }), filename);
  return (
    <Section
      title={title}
      action={
        <Tooltip title={t("common.downloadCsv")}>
          <span>
            <IconButton
              onClick={download}
              aria-label={`${t("common.downloadCsv")}: ${title}`}
              disabled={!rows.length}
            >
              <DownloadRounded />
            </IconButton>
          </span>
        </Tooltip>
      }
    >
      {empty ? <Typography color="text.secondary">{t("analytics.noData")}</Typography> : children}
    </Section>
  );
}

/** A-06 Analytics (docs/03). Scoped to the officer's areas by the API. */
// Admin-only LLM usage (docs/06 task 5.6); the API sends `sahayak: null` to authorities.
const SAHAYAK_ROWS = [
  "userMessages",
  "llmReplies",
  "letters",
  "emergencies",
  "users",
  "tokensInPer100",
  "tokensOutPer100",
  "avgLatencyMs",
];

/** "Was this helpful?" votes from citizens (admin only; counts, never who voted). */
function FeedbackChart({ feedback, suffix }) {
  const { t } = useTranslation("portal");
  const localized = useLocalized();
  const rows = [
    [t("analytics.feedback.sahayak"), feedback.sahayak.helpful, feedback.sahayak.notHelpful],
    ...feedback.schemes.map((s) => [localized(s.name) || s.id, s.helpful, s.notHelpful]),
  ];
  const header = [
    t("analytics.feedback.item"),
    t("analytics.feedback.helpful"),
    t("analytics.feedback.notHelpful"),
  ];
  return (
    <Chart
      title={t("analytics.charts.feedback")}
      header={header}
      rows={rows}
      filename={`helpful_votes_${suffix}.csv`}
      empty={rows.every((r) => r[1] + r[2] === 0)}
    >
      <Table size="small">
        <TableHead>
          <TableRow>
            {header.map((h, i) => (
              <TableCell key={h} align={i ? "right" : "left"}>
                {h}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r[0]}>
              <TableCell>{r[0]}</TableCell>
              <TableCell align="right">{r[1]}</TableCell>
              <TableCell align="right">{r[2]}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Chart>
  );
}

export default function AnalyticsPage() {
  const { t } = useTranslation("portal");
  const [preset, setPreset] = useState("30");
  const [custom, setCustom] = useState({ from: daysAgo(30), to: iso(new Date()) });
  const range =
    preset === "custom" ? custom : { from: daysAgo(Number(preset)), to: iso(new Date()) };
  const q = useQuery({
    queryKey: ["admin", "analytics", range.from, range.to],
    queryFn: () => adminApi.analytics(range),
    enabled: Boolean(range.from && range.to && range.from <= range.to),
  });
  const cat = (c) => t(`categories.${c}`, { ns: "complaints" });
  const st = (s) => t(`status.${s}`, { ns: "common" });
  const d = q.data;
  const suffix = `${range.from}_${range.to}`;

  return (
    <Stack spacing={2}>
      <PageTitle sx={{ mb: 0 }}>{t("analytics.title")}</PageTitle>
      <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
        <FilterChips
          label={t("analytics.range")}
          value={preset}
          onChange={setPreset}
          options={["7", "30", "90", "custom"].map((v) => ({
            value: v,
            label: t(`analytics.presets.${v}`),
          }))}
        />
        {preset === "custom" && (
          <>
            <TextField
              size="small"
              type="date"
              label={t("analytics.from")}
              value={custom.from}
              onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
            />
            <TextField
              size="small"
              type="date"
              label={t("analytics.to")}
              value={custom.to}
              onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
            />
          </>
        )}
      </Stack>
      {q.isLoading && <ListSkeleton rows={4} />}
      {q.isError && <ErrorCard network={apiError(q.error).network} onRetry={() => q.refetch()} />}
      {d && (
        <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" } }}>
          <Chart
            title={t("analytics.charts.byCategory")}
            header={[t("analytics.category"), t("analytics.count")]}
            rows={d.byCategory.map((x) => [cat(x.category), x.count])}
            filename={`complaints_by_category_${suffix}.csv`}
            empty={d.byCategory.every((x) => x.count === 0)}
          >
            <BarChart
              height={280}
              layout="horizontal"
              yAxis={[
                { scaleType: "band", data: d.byCategory.map((x) => cat(x.category)), width: 150 },
              ]}
              series={[
                {
                  data: d.byCategory.map((x) => x.count),
                  color: NAVY,
                  label: t("analytics.count"),
                },
              ]}
              slotProps={{ legend: { hidden: true } }}
              margin={{ left: 150 }}
            />
          </Chart>
          <Chart
            title={t("analytics.charts.funnel")}
            header={[t("analytics.status"), t("analytics.count")]}
            rows={d.funnel.map((x) => [st(x.status), x.count])}
            filename={`status_funnel_${suffix}.csv`}
            empty={d.funnel[0].count === 0}
          >
            <BarChart
              height={260}
              layout="horizontal"
              yAxis={[{ scaleType: "band", data: d.funnel.map((x) => st(x.status)), width: 120 }]}
              series={[
                { data: d.funnel.map((x) => x.count), color: SAFFRON, label: t("analytics.count") },
              ]}
              slotProps={{ legend: { hidden: true } }}
              margin={{ left: 120 }}
            />
          </Chart>
          <Chart
            title={t("analytics.charts.resolution")}
            header={[t("analytics.week"), t("analytics.charts.resolution"), t("analytics.count")]}
            rows={d.resolutionByWeek.map((x) => [x.week, x.avgDays, x.count])}
            filename={`resolution_by_week_${suffix}.csv`}
            empty={!d.resolutionByWeek.length}
          >
            <LineChart
              height={260}
              xAxis={[{ scaleType: "point", data: d.resolutionByWeek.map((x) => x.week) }]}
              yAxis={yFrom(d.resolutionByWeek.map((x) => x.avgDays))}
              series={[{ data: d.resolutionByWeek.map((x) => x.avgDays), color: NAVY }]}
            />
          </Chart>
          <Chart
            title={t("analytics.charts.perDay")}
            header={[t("analytics.day"), t("analytics.count")]}
            rows={d.complaintsPerDay.map((x) => [x.day, x.count])}
            filename={`complaints_per_day_${suffix}.csv`}
            empty={!d.complaintsPerDay.length}
          >
            <LineChart
              height={260}
              xAxis={[{ scaleType: "point", data: d.complaintsPerDay.map((x) => x.day.slice(5)) }]}
              yAxis={yFrom(d.complaintsPerDay.map((x) => x.count))}
              series={[{ data: d.complaintsPerDay.map((x) => x.count), color: SAFFRON }]}
            />
          </Chart>
          <Chart
            title={t("analytics.charts.sos")}
            header={[t("analytics.day"), t("analytics.count")]}
            rows={d.sosPerDay.map((x) => [x.day, x.count])}
            filename={`sos_per_day_${suffix}.csv`}
            empty={!d.sosPerDay.length}
          >
            <BarChart
              height={240}
              xAxis={[{ scaleType: "band", data: d.sosPerDay.map((x) => x.day.slice(5)) }]}
              yAxis={yFrom(d.sosPerDay.map((x) => x.count))}
              series={[{ data: d.sosPerDay.map((x) => x.count), color: "#C62828" }]}
            />
            <Typography sx={{ mt: 1 }}>
              {d.sosAvgAckMinutes === null
                ? t("analytics.charts.sosAckNone")
                : t("analytics.charts.sosAck", { n: d.sosAvgAckMinutes })}
            </Typography>
          </Chart>
          <Chart
            title={t("analytics.charts.schemes")}
            header={[t("analytics.scheme"), t("analytics.charts.views")]}
            rows={d.schemes.topViewed.map((x) => [x.slug, x.views])}
            filename={`top_schemes_${suffix}.csv`}
            empty={false}
          >
            <Typography sx={{ mb: 1 }}>
              {t("analytics.charts.checks", { n: d.schemes.checks })}
            </Typography>
            <Typography sx={{ fontWeight: 500 }}>{t("analytics.charts.topSchemes")}</Typography>
            <Table size="small">
              <TableBody>
                {d.schemes.topViewed.map((x) => (
                  <TableRow key={x.slug}>
                    <TableCell>{x.slug}</TableCell>
                    <TableCell align="right">{x.views}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Chart>
          <Chart
            title={t("analytics.charts.ai")}
            header={[
              t("analytics.charts.aiWith"),
              t("analytics.charts.aiAccepted"),
              t("analytics.charts.aiCorrected"),
            ]}
            rows={[[d.ai.withSuggestion, d.ai.acceptedPct ?? "", d.ai.correctedPct ?? ""]]}
            filename={`ai_performance_${suffix}.csv`}
            empty={d.ai.withSuggestion === 0}
          >
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t("analytics.charts.aiWith")}</TableCell>
                  <TableCell align="right">{d.ai.withSuggestion}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell>{t("analytics.charts.aiAccepted")}</TableCell>
                  <TableCell align="right">{d.ai.acceptedPct ?? "—"}%</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>{t("analytics.charts.aiCorrected")}</TableCell>
                  <TableCell align="right">{d.ai.correctedPct ?? "—"}%</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Chart>
          {d.sahayak && (
            <Chart
              title={t("analytics.charts.sahayak")}
              header={SAHAYAK_ROWS.map((k) => t(`analytics.sahayak.${k}`))}
              rows={[SAHAYAK_ROWS.map((k) => d.sahayak[k] ?? "")]}
              filename={`sahayak_usage_${suffix}.csv`}
              empty={d.sahayak.userMessages === 0}
            >
              <Table size="small">
                <TableBody>
                  {SAHAYAK_ROWS.map((k) => (
                    <TableRow key={k}>
                      <TableCell>{t(`analytics.sahayak.${k}`)}</TableCell>
                      <TableCell align="right">{d.sahayak[k] ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {t("analytics.sahayak.costHint")}
              </Typography>
            </Chart>
          )}
          {d.feedback && <FeedbackChart feedback={d.feedback} suffix={suffix} />}
        </Box>
      )}
    </Stack>
  );
}
