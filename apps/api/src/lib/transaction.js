import mongoose from "mongoose";

/**
 * Runs fn(session) in a transaction (docs/05 §12). Atlas is a replica set, so production always
 * gets one; a standalone local mongod doesn't support transactions, so fn runs without a session.
 */
export async function withTransaction(fn) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } catch (err) {
    const standalone =
      err?.code === 20 || /replica set|Transaction numbers/i.test(String(err?.message));
    if (!standalone) throw err;
    return fn(undefined);
  } finally {
    await session.endSession();
  }
}
