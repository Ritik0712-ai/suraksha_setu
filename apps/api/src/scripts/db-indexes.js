// npm run db:indexes — creates every index declared in the models (docs/05 §6).
// Production runs with autoIndex: false, so run this after each deploy that changes indexes.
import mongoose from "mongoose";
import { run } from "./_run.js";
import "../models/index.js";

await run("db:indexes", async () => {
  for (const model of Object.values(mongoose.models)) {
    await model.syncIndexes();
    console.log(`✓ ${model.collection.collectionName}`);
  }
});
