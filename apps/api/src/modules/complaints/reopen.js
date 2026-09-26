import { MAX_REOPENS } from "../../models/Complaint.js";

export const REOPEN_WINDOW_MS = 7 * 24 * 3600 * 1000; // docs/05 §5.6.1

/** Whether the owner may reopen now (docs/05 §5.6.1), and until when. */
export function reopenState(c, now = new Date()) {
  if (c.status !== "RESOLVED" || !c.resolvedAt) return { canReopen: false, reopenUntil: null };
  const until = new Date(new Date(c.resolvedAt).getTime() + REOPEN_WINDOW_MS);
  return {
    canReopen: now < until && c.reopenCount < MAX_REOPENS,
    reopenUntil: until,
  };
}
