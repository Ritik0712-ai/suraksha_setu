// npm run db:seed:schemes [-- --force] — imports seed/schemes.json as drafts (doc 06 task 4C.1).
// Publish each scheme from the portal (A-08) after checking it against the official source.
import { readFile } from "node:fs/promises";
import { run } from "./_run.js";
import { seedSchemes } from "./seedSchemes.js";

await run("db:seed:schemes", async () => {
  const data = JSON.parse(
    await readFile(new URL("../../seed/schemes.json", import.meta.url), "utf8"),
  );
  const counts = await seedSchemes(data, {
    force: process.argv.includes("--force"),
    log: console.log,
  });
  console.log(`schemes: ${JSON.stringify(counts)}`);
});
