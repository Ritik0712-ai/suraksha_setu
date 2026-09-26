// Fails if any i18n key exists in one language but not the other (docs/02 §11 Localisation).
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../src/i18n/locales", import.meta.url));
const langs = ["hi", "en"];

function flatten(obj, prefix = "") {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object" ? flatten(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

const namespaces = new Set(langs.flatMap((l) => readdirSync(join(root, l))));
const problems = [];

for (const ns of namespaces) {
  const keys = {};
  for (const l of langs) {
    const file = join(root, l, ns);
    if (!existsSync(file)) {
      problems.push(`${l}/${ns} is missing`);
      keys[l] = new Set();
      continue;
    }
    const data = JSON.parse(readFileSync(file, "utf8"));
    keys[l] = new Set(flatten(data));
    for (const k of keys[l]) {
      const value = k.split(".").reduce((o, p) => o[p], data);
      if (typeof value === "string" && !value.trim()) problems.push(`${l}/${ns}: "${k}" is empty`);
    }
  }
  for (const a of langs)
    for (const b of langs)
      if (a !== b)
        for (const k of keys[a])
          if (!keys[b].has(k)) problems.push(`${b}/${ns}: missing "${k}" (present in ${a})`);
}

if (problems.length) {
  console.error(`i18n check failed:\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log(`i18n check passed (${namespaces.size} namespace(s), ${langs.join(" + ")})`);
