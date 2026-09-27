import { randomBytes } from "node:crypto";
import { z } from "zod";

const optional = z
  .string()
  .optional()
  .transform((v) => (v === "" ? undefined : v));

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(5000),
  MONGODB_URI: optional,
  JWT_ACCESS_SECRET: optional,
  REFRESH_TOKEN_PEPPER: optional,
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:5173")
    .transform((v) =>
      v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  PUBLIC_APP_URL: z.string().default("http://localhost:5173"),
  // Public URL of this API. Only used for photo URLs when photos are stored on local disk.
  API_PUBLIC_URL: optional,
  CLOUDINARY_URL: optional,
  SMTP_HOST: optional,
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: optional,
  SMTP_PASS: optional,
  MAIL_FROM: optional,
  // Backup SMTP (e.g. Brevo), used only when the primary fails (docs/02 §4.1).
  SMTP_FALLBACK_HOST: optional,
  SMTP_FALLBACK_PORT: z.coerce.number().int().positive().default(587),
  SMTP_FALLBACK_USER: optional,
  SMTP_FALLBACK_PASS: optional,
  // Brevo's HTTPS email API (free: 300 emails/day). Tried first when set: Render's free plan
  // blocks outbound SMTP ports, so SMTP only works locally or on other hosts.
  BREVO_API_KEY: optional,
  AI_BASE_URL: optional,
  AI_INTERNAL_KEY: optional,
  GOOGLE_PLACES_KEY: optional,
  // Hard cap on billed Places calls per IST day, per API instance (docs/02 §7.5 cost control).
  PLACES_DAILY_LIMIT: z.coerce.number().int().min(0).default(300),
  // development | preview | production — separates Cloudinary folders (docs/06 task 5.1).
  // Defaults to NODE_ENV, so a Vercel/Render preview can set "preview".
  APP_ENV: optional,
  // bcrypt cost (docs/02 SEC-02). Only tests may lower it.
  BCRYPT_COST: z.coerce.number().int().min(4).max(15).default(12),
});

/** Parse and validate environment variables. Throws with a readable list of problems. */
export function loadEnv(source = process.env) {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment: ${issues}`);
  }
  const env = parsed.data;
  if (env.NODE_ENV === "production") {
    const required = [
      "MONGODB_URI",
      "JWT_ACCESS_SECRET",
      "REFRESH_TOKEN_PEPPER",
      "AI_INTERNAL_KEY",
    ];
    const missing = required.filter((k) => !env[k]);
    if (missing.length)
      throw new Error(`Missing required env in production: ${missing.join(", ")}`);
    if (env.BCRYPT_COST < 12) throw new Error("BCRYPT_COST must be at least 12 in production");
  } else {
    // Outside production, missing secrets get a random per-process value so the API still boots.
    // Every restart then logs everyone out, which is fine for local development.
    for (const k of ["JWT_ACCESS_SECRET", "REFRESH_TOKEN_PEPPER"]) {
      if (!env[k]) env[k] = randomBytes(32).toString("base64url");
    }
  }
  return env;
}
