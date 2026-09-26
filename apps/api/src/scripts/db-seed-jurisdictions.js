// npm run db:seed:jurisdictions — pilot tree from seed/jurisdictions.json (docs/05 §11.1).
import { readFile } from "node:fs/promises";
import { run } from "./_run.js";
import { seedJurisdictionTree } from "./seedJurisdictions.js";

const file = new URL("../../seed/jurisdictions.json", import.meta.url);

await run("db:seed:jurisdictions", async () => {
  const data = JSON.parse(await readFile(file, "utf8"));
  if (!data.verified) console.warn("⚠ seed/jurisdictions.json is not verified yet (placeholders)");
  await seedJurisdictionTree(data.tree, null, console.log);
});
