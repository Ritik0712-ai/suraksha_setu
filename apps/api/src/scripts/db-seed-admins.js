// npm run db:seed:admins — one admin per team member (docs/06 task 1.9).
// Reads seed/admins.local.json (git-ignored; copy seed/admins.example.json) or SEED_ADMINS_FILE.
// Temporary passwords are printed ONCE; share them privately. Each admin must change it on login.
import { readFile } from "node:fs/promises";
import { run } from "./_run.js";
import { seedAdmins } from "./seedAdmins.js";

const file =
  process.env.SEED_ADMINS_FILE || new URL("../../seed/admins.local.json", import.meta.url);

await run("db:seed:admins", async (env) => {
  const members = JSON.parse(await readFile(file, "utf8"));
  for (const r of await seedAdmins(members, { bcryptCost: env.BCRYPT_COST })) {
    console.log(
      r.status === "created"
        ? `+ ${r.name} (${r.phone}) temporary password: ${r.tempPassword}`
        : `= ${r.name} (${r.phone}) already exists — skipped`,
    );
  }
});
