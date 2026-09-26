import C from "../config/constants.js";
import { SosAlert } from "../models/SosAlert.js";
import { AUTO_CLOSE_AFTER_MS } from "../modules/sos/service.js";

/**
 * An SOS with no update for 6 hours is closed and logged (docs/01 FR-SOS-11). Its tracking
 * link stops showing a location at the same time.
 * @returns number of alerts closed
 */
export async function autoCloseStaleSos({ realtime, now = new Date() }) {
  const stale = await SosAlert.find({
    status: { $in: C.sosOpenStatus },
    lastUpdateAt: { $lt: new Date(now.getTime() - AUTO_CLOSE_AFTER_MS) },
  });
  let closed = 0;
  for (const s of stale) {
    const updated = await SosAlert.findOneAndUpdate(
      { _id: s._id, status: { $in: C.sosOpenStatus } },
      { $set: { status: "AUTO_CLOSED", resolvedAt: now, trackTokenExpiresAt: now } },
      { new: true },
    );
    if (!updated) continue;
    closed += 1;
    const event = { id: String(updated._id), status: updated.status };
    realtime.toScope(updated, "sos:updated", event);
    realtime.toUser(updated.userId, "sos:updated", event);
  }
  return closed;
}
