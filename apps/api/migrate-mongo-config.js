// migrate-mongo configuration (docs/05 §14, docs/06 task 2.2).
// Migrations live in ./migrations as idempotent scripts named <timestamp>-<name>.js.
// Take an Atlas snapshot or mongodump before running them against production.
try {
  process.loadEnvFile(new URL("./.env", import.meta.url));
} catch {
  // No .env file: rely on the real environment (CI, Render).
}

const url = process.env.MONGODB_URI;
if (!url) throw new Error("MONGODB_URI is not set (put it in apps/api/.env)");

export default {
  mongodb: { url, options: {} },
  migrationsDir: "migrations",
  changelogCollectionName: "changelog",
  lockCollectionName: "changelog_lock",
  lockTtl: 300,
  migrationFileExtension: ".js",
  useFileHash: false,
  moduleSystem: "esm",
};
