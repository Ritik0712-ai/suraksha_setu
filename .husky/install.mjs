// `npm install` runs this (the "prepare" script) to set up the git hooks for developers.
// Build machines (Render, Vercel, CI) and API-only installs don't have husky or need hooks.
if (process.env.HUSKY === "0" || process.env.NODE_ENV === "production") process.exit(0);
try {
  const { default: husky } = await import("husky");
  const msg = husky();
  if (msg) console.log(msg);
} catch {
  // husky isn't installed (e.g. `npm ci --workspace apps/api`): nothing to set up.
}
