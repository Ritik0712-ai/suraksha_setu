import { Notification } from "../models/Notification.js";

/**
 * In-app notification (docs/05 §5.16): stored, then pushed live to the recipient's socket room.
 * templateKey is an i18n key the web app renders in the reader's current language.
 */
export async function notify(realtime, { recipientId, type, templateKey, params = {}, link }) {
  const n = await Notification.create({ recipientId, type, templateKey, params, link });
  realtime.toUser(recipientId, "notification:new", {
    id: String(n._id),
    type,
    templateKey,
    params,
    link,
    createdAt: n.createdAt,
  });
  return n;
}
