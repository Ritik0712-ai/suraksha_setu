import { Fragment, useState } from "react";
import {
  Box,
  Button,
  Collapse,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { Link as RouterLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { apiError } from "../../api/client.js";
import { adminApi } from "../../api/endpoints.js";
import { formatDateTime } from "../../lib/time.js";
import { PageTitle } from "../../components/ui/PageTitle.jsx";
import { ErrorCard, ListSkeleton } from "../../components/ui/States.jsx";

const LINKS = {
  complaints: (id) => `/portal/complaints/${id}`,
  sos_alerts: (id) => `/portal/sos/${id}`,
  schemes: (id) => `/portal/admin/schemes/${id}`,
};

/** A-13 Audit log (docs/03): read-only, filterable. Admin only. */
export default function AuditPage() {
  const { t } = useTranslation("portal");
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(null);
  const params = {
    page,
    ...(action.trim() ? { action: action.trim() } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  };
  const q = useQuery({
    queryKey: ["admin", "audit", params],
    queryFn: () => adminApi.audit(params),
    placeholderData: (p) => p,
  });
  const items = q.data?.items ?? [];
  return (
    <Stack spacing={2}>
      <PageTitle sx={{ mb: 0 }}>{t("audit.title")}</PageTitle>
      <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
        <TextField
          size="small"
          label={t("audit.action")}
          placeholder="complaint."
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setPage(1);
          }}
        />
        <TextField
          size="small"
          type="date"
          label={t("audit.from")}
          value={from}
          onChange={(e) => {
            setFrom(e.target.value);
            setPage(1);
          }}
        />
        <TextField
          size="small"
          type="date"
          label={t("audit.to")}
          value={to}
          onChange={(e) => {
            setTo(e.target.value);
            setPage(1);
          }}
        />
      </Stack>
      {q.isLoading && <ListSkeleton />}
      {q.isError && <ErrorCard network={apiError(q.error).network} onRetry={() => q.refetch()} />}
      {q.isSuccess && items.length === 0 && (
        <Typography color="text.secondary">{t("audit.empty")}</Typography>
      )}
      {items.length > 0 && (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                {["time", "actor", "action", "target", "details", "ip"].map((c) => (
                  <TableCell key={c}>{t(`audit.cols.${c}`)}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((l) => (
                <Fragment key={l.id}>
                  <TableRow>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{formatDateTime(l.at)}</TableCell>
                    <TableCell>
                      {l.actor.name ?? "—"}{" "}
                      <Typography component="span" variant="body2" color="text.secondary">
                        ({t(`roles.${l.actor.role}`)})
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ fontFamily: "monospace" }}>{l.action}</TableCell>
                    <TableCell>
                      {LINKS[l.targetType] ? (
                        <RouterLink to={LINKS[l.targetType](l.targetId)}>{l.targetType}</RouterLink>
                      ) : (
                        l.targetType
                      )}
                    </TableCell>
                    <TableCell>
                      {l.changes && (
                        <Button
                          size="small"
                          onClick={() => setOpen(open === l.id ? null : l.id)}
                          aria-expanded={open === l.id}
                        >
                          {t("audit.showDetails")}
                        </Button>
                      )}
                    </TableCell>
                    <TableCell sx={{ fontFamily: "monospace" }}>{l.ipPrefix ?? "—"}</TableCell>
                  </TableRow>
                  {l.changes && (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        sx={{ py: 0, borderBottom: open === l.id ? undefined : 0 }}
                      >
                        <Collapse in={open === l.id} unmountOnExit>
                          <Box
                            component="pre"
                            sx={{ m: 0, py: 1, fontSize: "0.85rem", whiteSpace: "pre-wrap" }}
                          >
                            {JSON.stringify(l.changes, null, 2)}
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      {q.isSuccess && q.data.total > 50 && (
        <TablePagination
          component="div"
          count={q.data.total}
          page={page - 1}
          onPageChange={(_e, p) => setPage(p + 1)}
          rowsPerPage={50}
          rowsPerPageOptions={[50]}
        />
      )}
    </Stack>
  );
}
