import { describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { useTestDb } from "../helpers/db.js";
import { nextComplaintNo } from "../../src/models/Counter.js";

useTestDb();

describe("nextComplaintNo (docs/01 FR-CMP-06, docs/05 §5.19)", () => {
  it("counts up per IST year with 6-digit padding", async () => {
    const d = new Date("2026-10-02T09:30:00Z");
    expect(await nextComplaintNo({ date: d })).toBe("SS-2026-000001");
    expect(await nextComplaintNo({ date: d })).toBe("SS-2026-000002");
    // 1 Jan 2027 00:10 IST is still 2026 in UTC, but numbering restarts for 2027.
    expect(await nextComplaintNo({ date: new Date("2026-12-31T18:40:00Z") })).toBe(
      "SS-2027-000001",
    );
  });

  it("never hands out the same number twice under concurrency", async () => {
    const d = new Date("2026-10-02T09:30:00Z");
    const numbers = await Promise.all(
      Array.from({ length: 25 }, () => nextComplaintNo({ date: d })),
    );
    expect(new Set(numbers).size).toBe(25);
    expect(numbers.sort().at(-1)).toBe("SS-2026-000025");
  });

  it("rolls back with the transaction it is part of", async () => {
    const d = new Date("2026-10-02T09:30:00Z");
    const session = await mongoose.startSession();
    await expect(
      session.withTransaction(async () => {
        await nextComplaintNo({ date: d, session });
        throw new Error("complaint insert failed");
      }),
    ).rejects.toThrow("complaint insert failed");
    await session.endSession();
    expect(await nextComplaintNo({ date: d })).toBe("SS-2026-000001");
  });
});
