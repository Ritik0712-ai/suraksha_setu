import { useState } from "react";
import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  LinearProgress,
  Link,
  Stack,
  Typography,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { apiError } from "../../api/client.js";
import { schemesApi } from "../../api/endpoints.js";
import { useEligibility } from "../../stores/eligibility.js";
import { useSession } from "../../stores/session.js";
import { Notice } from "../../components/ui/Notice.jsx";
import { PageTitle } from "../../components/ui/PageTitle.jsx";
import { SubmitButton } from "../../components/ui/fields.jsx";
import { activeQuestions, cleanAnswers, optionsFor } from "./questions.js";

/** S-16 Eligibility checker (docs/03): one question per screen, tap = answer + next. */
export default function EligibilityPage() {
  const { t } = useTranslation("schemes");
  const navigate = useNavigate();
  const user = useSession((s) => s.user);
  const citizen = useSession((s) => s.status === "authed" && s.user?.role === "citizen");
  const profileGender = user?.gender ?? null;
  const { answers, setAnswer, setAnswers, setResults, save, setSave } = useEligibility();
  const questions = activeQuestions(answers, profileGender);
  const firstOpen = questions.findIndex((f) => answers[f] === undefined);
  const [index, setIndex] = useState(firstOpen === -1 ? questions.length : firstOpen);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const field = questions[index];
  const done = index >= questions.length;

  const answer = (value) => {
    setAnswer(field, value);
    const next = { ...answers, [field]: value };
    const list = activeQuestions(next, profileGender);
    setIndex(list.indexOf(field) + 1);
  };

  const back = () => {
    if (index > 0) setIndex(index - 1);
    else navigate(-1);
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    const clean = cleanAnswers(answers, profileGender);
    setAnswers(clean);
    try {
      const res = await schemesApi.check({
        answers: clean,
        ...(citizen && save ? { save: true } : {}),
      });
      setResults(res);
      navigate("/schemes/check/results");
    } catch (err) {
      const e = apiError(err);
      setError(e.network ? t("states.networkError", { ns: "common" }) : e.message);
      setBusy(false);
    }
  };

  return (
    <Stack spacing={2.5} sx={{ maxWidth: 560, mx: "auto" }}>
      <PageTitle sx={{ mb: 0 }}>{t("check.title")}</PageTitle>
      {index === 0 && <Notice>{t("check.privacy")}</Notice>}
      <Box>
        <Typography variant="body2" color="text.secondary" aria-live="polite">
          {t("check.progress", {
            current: Math.min(index + 1, questions.length),
            total: questions.length,
          })}
        </Typography>
        <LinearProgress
          variant="determinate"
          value={(Math.min(index, questions.length) / questions.length) * 100}
          aria-hidden
          sx={{ height: 8, borderRadius: 4, mt: 1, bgcolor: "primary.light" }}
        />
      </Box>

      {!done && (
        <Stack spacing={1.5} role="radiogroup" aria-labelledby="question-title">
          <Typography id="question-title" variant="h2">
            {t(`check.q.${field}`)}
          </Typography>
          {optionsFor(field).map((v) => (
            <Button
              key={v}
              role="radio"
              aria-checked={answers[field] === v}
              variant={answers[field] === v ? "contained" : "outlined"}
              onClick={() => answer(v)}
              sx={{ minHeight: 56, justifyContent: "flex-start", fontSize: "1.0625rem" }}
            >
              {t(`check.a.${field}.${v}`)}
            </Button>
          ))}
        </Stack>
      )}

      {done && (
        <Stack spacing={2}>
          <Typography sx={{ fontSize: "1.125rem" }}>{t("check.ready")}</Typography>
          {citizen && (
            <FormControlLabel
              control={<Checkbox checked={save} onChange={(e) => setSave(e.target.checked)} />}
              label={t("check.saveAnswers")}
            />
          )}
          {error && <Notice kind="error" title={error} />}
          <SubmitButton type="button" busy={busy} onClick={submit}>
            {t("check.see")}
          </SubmitButton>
        </Stack>
      )}

      <Link component="button" type="button" onClick={back} sx={{ alignSelf: "flex-start", py: 1 }}>
        {t("check.back")}
      </Link>
    </Stack>
  );
}
