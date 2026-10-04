import { IconButton, Stack, Tooltip, Typography } from "@mui/material";
import {
  ThumbDownAltOutlined,
  ThumbDownAltRounded,
  ThumbUpAltOutlined,
  ThumbUpAltRounded,
} from "@mui/icons-material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiError } from "../../api/client.js";
import { feedbackApi } from "../../api/endpoints.js";
import { useSession } from "../../stores/session.js";
import { toast } from "../../stores/toast.js";
import { feedbackKey as key } from "../../lib/feedback.js";

/**
 * "Was this helpful? 👍 👎" — signed-in users only (guests see nothing). `ids` is the list the
 * page loaded votes for, so a vote updates that cached list straight away.
 */
export function HelpfulVote({ target, targetId, ids, value, label, size = "medium" }) {
  const { t } = useTranslation("common");
  const qc = useQueryClient();
  const authed = useSession((s) => s.status === "authed");
  const vote = useMutation({
    mutationFn: (helpful) => feedbackApi.vote({ target, targetId, helpful }),
    onMutate: (helpful) =>
      qc.setQueryData(key(target, (ids ?? [targetId]).filter(Boolean)), (old) => ({
        ...old,
        [targetId]: helpful,
      })),
    onSuccess: () => toast(t("feedback.thanks")),
    onError: (err) => {
      qc.invalidateQueries({ queryKey: ["feedback", target] });
      toast(apiError(err).message, "error");
    },
  });
  if (!authed || !targetId) return null;

  const thumb = (helpful) => {
    const on = value === helpful;
    const name = t(helpful ? "feedback.yes" : "feedback.no");
    const Icon = helpful
      ? on
        ? ThumbUpAltRounded
        : ThumbUpAltOutlined
      : on
        ? ThumbDownAltRounded
        : ThumbDownAltOutlined;
    return (
      <Tooltip title={name}>
        <IconButton
          size={size}
          aria-label={name}
          aria-pressed={on}
          disabled={vote.isPending}
          onClick={() => !on && vote.mutate(helpful)}
          color={on ? (helpful ? "success" : "error") : "default"}
        >
          <Icon fontSize={size === "small" ? "small" : "medium"} />
        </IconButton>
      </Tooltip>
    );
  };

  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={0.25}
      role="group"
      aria-label={label ?? t("feedback.question")}
    >
      {label && (
        <Typography sx={{ mr: 1, fontWeight: 500 }} component="span">
          {label}
        </Typography>
      )}
      {thumb(true)}
      {thumb(false)}
    </Stack>
  );
}
