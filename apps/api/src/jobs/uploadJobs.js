import { logger } from "../lib/logger.js";
import { Upload } from "../models/Upload.js";

export const STALE_UPLOAD_MS = 24 * 3600 * 1000; // docs/05 §5.7

/**
 * Deletes photos that were uploaded but never attached to a complaint within 24 h — the citizen
 * retook the photo or left the wizard (docs/05 §5.7, doc 06 task 4B.9). The file goes first,
 * then the record, so a failed delete is retried next hour.
 */
export async function cleanupStaleUploads({ storage, now = new Date(), batch = 500 }) {
  const stale = await Upload.find({
    status: "pending",
    createdAt: { $lt: new Date(now.getTime() - STALE_UPLOAD_MS) },
  })
    .sort({ createdAt: 1 })
    .limit(batch)
    .lean();
  let removed = 0;
  for (const u of stale) {
    try {
      if (storage) await storage.destroy(u.publicId);
      const res = await Upload.deleteOne({ _id: u._id, status: "pending" });
      removed += res.deletedCount;
    } catch (err) {
      logger.warn({ err, uploadId: String(u._id) }, "couldn't delete stale upload");
    }
  }
  return { removed, found: stale.length };
}
