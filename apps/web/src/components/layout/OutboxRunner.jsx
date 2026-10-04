import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { flushOutbox, loadOutbox, useOutbox } from "../../lib/outbox.js";
import { useNetwork } from "../../stores/network.js";
import { useSession } from "../../stores/session.js";
import { toast } from "../../stores/toast.js";

const RETRY_MS = 60_000;

/**
 * Sends complaints that were saved on the phone without internet (lib/outbox.js): when the app
 * opens signed in, when the browser comes back online, and every minute while any are waiting.
 * Renders nothing.
 */
export function OutboxRunner() {
  const { t } = useTranslation("complaints");
  const qc = useQueryClient();
  const status = useSession((s) => s.status);
  const userId = useSession((s) => s.user?.id ?? null);
  const online = useNetwork((s) => s.browserOnline);
  const waiting = useOutbox((s) => s.items.length);

  useEffect(() => {
    loadOutbox(userId);
  }, [userId]);

  useEffect(() => {
    if (status !== "authed" || !userId || !online || !waiting) return undefined;
    let stop = false;
    const run = async () => {
      const sent = await flushOutbox(userId);
      if (stop || !sent.length) return;
      toast(
        sent.length === 1
          ? t("outbox.sentOne", { no: sent[0].complaintNo })
          : t("outbox.sentMany", { count: sent.length }),
      );
      qc.invalidateQueries({ queryKey: ["complaints"] });
    };
    run();
    const id = setInterval(run, RETRY_MS);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [status, userId, online, waiting, qc, t]);

  return null;
}
