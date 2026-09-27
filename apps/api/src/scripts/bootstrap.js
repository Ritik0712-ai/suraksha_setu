// One-time database setup on Render's free plan, which has no shell (docs/runbook.md §2.5).
// `npm start` runs this first; it does nothing unless DB_BOOTSTRAP=1 is set on the service.
// Set DB_BOOTSTRAP=1 → deploy → check the logs → remove DB_BOOTSTRAP. Every step is idempotent
// (it checks before inserting), so a second run changes nothing.
//
// Steps: migrations → indexes → jurisdictions + departments → admins (only if BOOTSTRAP_ADMINS
// holds a JSON list like seed/admins.example.json; temporary passwords appear once in the deploy
// log) → the 20 schemes as drafts (needs an admin). The emergency directory stays empty until the
// team adds phone-verified rows in the portal (A-10).
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

if (process.env.DB_BOOTSTRAP !== "1") process.exit(0);

const apiDir = fileURLToPath(new URL("../..", import.meta.url));
const env = { ...process.env };

if (process.env.BOOTSTRAP_ADMINS) {
  const dir = mkdtempSync(join(tmpdir(), "ss-admins-"));
  const file = join(dir, "admins.json");
  JSON.parse(process.env.BOOTSTRAP_ADMINS); // fail early on invalid JSON
  writeFileSync(file, process.env.BOOTSTRAP_ADMINS, { mode: 0o600 });
  env.SEED_ADMINS_FILE = file;
}

const steps = [
  // `npm run` puts the workspace's and the repo root's node_modules/.bin on PATH (migrate-mongo).
  ["migrations", "npm", ["run", "db:migrate"]],
  ["indexes", "npm", ["run", "db:indexes"]],
  ["jurisdictions + departments", "npm", ["run", "db:seed"]],
  ...(env.SEED_ADMINS_FILE ? [["admins", "npm", ["run", "db:seed:admins"]]] : []),
  ["schemes (drafts)", "npm", ["run", "db:seed:schemes"]],
];

console.log("DB_BOOTSTRAP=1 — setting up the database (remove the flag afterwards)");
for (const [name, cmd, args] of steps) {
  console.log(`\n▶ ${name}`);
  const r = spawnSync(cmd, args, { cwd: apiDir, env, stdio: "inherit" });
  if (r.status !== 0) {
    // Keep going to the server: a failed seed must never keep the API (and SOS) down.
    console.error(`✖ ${name} failed (exit ${r.status}) — see above; the API starts anyway`);
  }
}
console.log("\nbootstrap finished — now remove DB_BOOTSTRAP (and BOOTSTRAP_ADMINS) on Render");
