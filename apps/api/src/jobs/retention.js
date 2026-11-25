import mongoose from "mongoose";
import C from "../config/constants.js";
import { logger } from "../lib/logger.js";
import { AuditLog } from "../models/AuditLog.js";
import { Complaint } from "../models/Complaint.js";
import { SosAlert } from "../models/SosAlert.js";
import { Upload } from "../models/Upload.js";

function yearsBefore(now, years) {
  const date = new Date(now);
  const month = date.getUTCMonth();
  date.setUTCFullYear(date.getUTCFullYear() - years);
  if (date.getUTCMonth() !== month) date.setUTCDate(0);
  return date;
}

function roundedCoordinates(path) {
  return { $map: { input: path, in: { $round: ["$$this", 3] } } };
}

export async function retainSos({ now = new Date() } = {}) {
  const closed = { status: { $nin: C.sosOpenStatus } };
  const expired = await SosAlert.deleteMany({
    ...closed,
    resolvedAt: { $lte: yearsBefore(now, 1) },
  });
  const trimmed = await SosAlert.updateMany(
    {
      ...closed,
      resolvedAt: { $lte: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1_000) },
      locationTrimmedAt: { $exists: false },
    },
    [
      {
        $set: {
          locationHistory: [],
          "startLocation.coordinates": roundedCoordinates("$startLocation.coordinates"),
          "lastLocation.coordinates": roundedCoordinates("$lastLocation.coordinates"),
          locationTrimmedAt: now,
        },
      },
      { $unset: "lastAccuracyM" },
    ],
  );
  return { deleted: expired.deletedCount, trimmed: trimmed.modifiedCount };
}

export async function retainComplaints({ storage, now = new Date(), batch = 100 }) {
  const due = { createdAt: { $lte: yearsBefore(now, 3) } };
  const candidates = await Complaint.find(due).sort({ createdAt: 1 }).limit(batch).select("_id");
  let deleted = 0;
  let retry = 0;
  for (const { _id } of candidates) {
    try {
      const removed = await mongoose.connection.transaction(async (session) => {
        // Acquire the document's write lock before reading its final image references.
        const complaint = await Complaint.findOneAndDelete({ _id, ...due }, { session }).lean();
        if (!complaint) return false;
        const attachments = await Upload.find({ attachedTo: _id })
          .select("publicId")
          .session(session)
          .lean();
        const images = new Set([
          complaint.imagePublicId,
          complaint.resolutionImagePublicId,
          ...attachments.map(({ publicId }) => publicId),
        ]);
        images.delete(undefined);
        images.delete(null);
        images.delete("");
        for (const publicId of images) {
          // Storage deletion is idempotent. Preserve the rows for retry when it fails.
          if (!(await storage?.destroy(publicId))) throw new Error("Photo deletion failed");
        }
        await Upload.deleteMany({ attachedTo: _id }, { session });
        return true;
      });
      if (removed) deleted += 1;
    } catch (err) {
      retry += 1;
      logger.warn(
        { errorType: err.name, complaintId: String(_id) },
        "complaint retention will retry",
      );
    }
  }
  return { deleted, retry };
}

export async function retainAuditLogs({ now = new Date() } = {}) {
  const result = await AuditLog.deleteMany({ createdAt: { $lte: yearsBefore(now, 2) } });
  return { deleted: result.deletedCount };
}
