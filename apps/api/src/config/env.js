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
  CLOUDINARY_URL: optional,
  SMTP_HOST: optional,
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: optional,
  SMTP_PASS: optional,
  MAIL_FROM: optional,
  AI_BASE_URL: optional,
  AI_INTERNAL_KEY: optional,
  GOOGLE_PLACES_KEY: optional,
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
  }
  return env;
}
