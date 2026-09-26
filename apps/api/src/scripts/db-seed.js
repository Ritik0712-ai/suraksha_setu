// npm run db:seed — jurisdictions, then departments + routing defaults (docs/06 task 2.4).
// National helplines need no seeding: they are static in shared/constants.json (docs/05 §5.13).
// Team admins are seeded separately with db:seed:admins (their phones stay out of git).
import { readFile } from "node:fs/promises";
import { run } from "./_run.js";
import { seedJurisdictionTree } from "./seedJurisdictions.js";
import { seedDepartments } from "./seedDepartments.js";

const read = async (name) =>
  JSON.parse(await readFile(new URL(`../../seed/${name}`, import.meta.url), "utf8"));

await run("db:seed", async () => {
  const jurisdictions = await read("jurisdictions.json");
  if (!jurisdictions.verified)
    console.warn("⚠ seed/jurisdictions.json is not verified yet (placeholders)");
  await seedJurisdictionTree(jurisdictions.tree, null, console.log);
  await seedDepartments(await read("departments.json"), console.log);
});
