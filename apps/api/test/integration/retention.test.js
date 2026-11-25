import { Types } from "mongoose";
import { describe, expect, it, vi } from "vitest";
import { retainAuditLogs, retainComplaints, retainSos } from "../../src/jobs/retention.js";
import { AuditLog } from "../../src/models/AuditLog.js";
import { Complaint } from "../../src/models/Complaint.js";
import { SosAlert } from "../../src/models/SosAlert.js";
import { Upload } from "../../src/models/Upload.js";
import { useTestDb } from "../helpers/db.js";

const now = new Date("2026-11-25T12:00:00Z");
const point = { type: "Point", coordinates: [77.123456, 23.654321] };

describe("documented retention jobs", () => {
  useTestDb();

  it("drops expired SOS records and rounds older closed positions once, preserving active alerts", async () => {
    await SosAlert.collection.insertMany(
      [
        ["expired", "AUTO_CLOSED", "2025-11-24"],
        ["trim", "AUTO_CLOSED", "2026-08-20"],
        ["recent", "AUTO_CLOSED", "2026-09-02"],
        ["active", "ACTIVE", "2026-07-01"],
      ].map(([trackTokenHash, status, date]) => ({
        trackTokenHash,
        status,
        userId: new Types.ObjectId(),
        resolvedAt: new Date(date),
        startLocation: point,
        lastLocation: point,
        lastAccuracyM: 12,
        locationHistory: [{ point, at: new Date(date) }],
      })),
    );
    await expect(retainSos({ now })).resolves.toEqual({ deleted: 1, trimmed: 1 });
    const kept = await SosAlert.find().lean();
    const trimmed = kept.find((a) => a.trackTokenHash === "trim");
    expect(trimmed.startLocation.coordinates).toEqual([77.123, 23.654]);
    expect(trimmed.lastLocation.coordinates).toEqual([77.123, 23.654]);
    expect(trimmed.locationHistory).toEqual([]);
    expect(trimmed.lastAccuracyM).toBeUndefined();
    expect(kept.filter((a) => a.locationHistory.length > 0)).toHaveLength(2);
    await expect(retainSos({ now })).resolves.toEqual({ deleted: 0, trimmed: 0 });
  });

  it("retries failed photo deletion and removes complaint and attachment rows together", async () => {
    const old = new Types.ObjectId();
    const recent = new Types.ObjectId();
    await Complaint.collection.insertMany([
      {
        _id: old,
        complaintNo: "SS-2023-000001",
        createdAt: new Date("2023-11-24"),
        imagePublicId: "initial",
        resolutionImagePublicId: "resolution",
      },
      { _id: recent, complaintNo: "SS-2023-000002", createdAt: new Date("2023-11-26") },
    ]);
    await Upload.collection.insertOne({ attachedTo: old, publicId: "initial", status: "attached" });
    const storage = { destroy: vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true) };
    await expect(retainComplaints({ storage, now })).resolves.toEqual({ deleted: 0, retry: 1 });
    expect(await Complaint.exists({ _id: old })).toBeTruthy();
    expect(await Upload.exists({ attachedTo: old })).toBeTruthy();
    await expect(retainComplaints({ storage, now })).resolves.toEqual({ deleted: 1, retry: 0 });
    expect(storage.destroy.mock.calls.flat()).toEqual(["initial", "initial", "resolution"]);
    expect(await Complaint.exists({ _id: recent })).toBeTruthy();
    expect(await Complaint.exists({ _id: old })).toBeNull();
    expect(await Upload.exists({ attachedTo: old })).toBeNull();
  });

  it("deletes audit logs past two years and retains more recent entries", async () => {
    await AuditLog.collection.insertMany([
      { createdAt: new Date("2024-11-24") },
      { createdAt: new Date("2024-11-26") },
    ]);
    await expect(retainAuditLogs({ now })).resolves.toEqual({ deleted: 1 });
    expect(await AuditLog.countDocuments()).toBe(1);
  });
});
