import mongoose from "mongoose";

const { Schema } = mongoose;

// docs/05 §5.19 — atomic sequences for human-readable IDs, e.g. _id "complaint:2026".
const CounterSchema = new Schema(
  {
    _id: { type: String, required: true },
    seq: { type: Number, required: true, default: 0 },
  },
  { collection: "counters", versionKey: false },
);

export const Counter = mongoose.models.Counter || mongoose.model("Counter", CounterSchema);

/** Year in India (IST), so numbering rolls over at midnight IST, not UTC. */
export function istYear(date = new Date()) {
  return Number(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric" }).format(date),
  );
}

/**
 * Next complaint number, "SS-2026-000123" (docs/01 FR-CMP-06). Pass `session` to include the
 * increment in a transaction with the complaint insert (docs/05 §12).
 */
export async function nextComplaintNo({ date = new Date(), session } = {}) {
  const year = istYear(date);
  const bump = () =>
    Counter.findOneAndUpdate(
      { _id: `complaint:${year}` },
      { $inc: { seq: 1 } },
      { upsert: true, new: true, session },
    );
  let doc;
  try {
    doc = await bump();
  } catch (err) {
    // Two first-ever upserts for a new year can race to insert the same _id; the loser retries
    // and increments the document the winner created.
    if (err?.code !== 11000) throw err;
    doc = await bump();
  }
  return `SS-${year}-${String(doc.seq).padStart(6, "0")}`;
}
