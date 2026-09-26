// npm run db:seed:emergency — imports seed/emergency_services.csv (doc 06 task 4D.2).
// Every row needs verified_on: the date someone phoned or visited to confirm it (docs/05 §11.3).
// Columns: see seed/emergency_services.template.csv (same format as the portal's Import CSV).
import { readFile } from "node:fs/promises";
import { run } from "./_run.js";
import { seedEmergencyServices } from "./seedEmergency.js";

await run("db:seed:emergency", async () => {
  let csv;
  try {
    csv = await readFile(new URL("../../seed/emergency_services.csv", import.meta.url), "utf8");
  } catch {
    console.log("seed/emergency_services.csv not found — copy the template and add verified rows");
    return;
  }
  const counts = await seedEmergencyServices(csv, { log: console.log });
  console.log(`emergency services: ${JSON.stringify(counts)}`);
});
