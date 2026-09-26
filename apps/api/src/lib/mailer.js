import nodemailer from "nodemailer";
import { logger } from "./logger.js";

/**
 * Email sender (docs/02 §4.1: Nodemailer via SMTP — Gmail app password, Brevo as backup).
 * Returns { configured, send(to, subject, text) }; send never throws and resolves to true when
 * one of the SMTP servers accepted the message.
 *
 * - Primary:  SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS
 * - Fallback: SMTP_FALLBACK_HOST / _PORT / _USER / _PASS (e.g. Brevo), tried only when the
 *   primary fails — so an SOS email still goes out if Gmail throttles or rejects us.
 *
 * Without any SMTP settings, emails are logged (subject only) and dropped, so local development
 * and tests work without a mail account.
 */
export function createMailer(env, { createTransport = nodemailer.createTransport } = {}) {
  const servers = [
    {
      name: "primary",
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
    {
      name: "fallback",
      host: env.SMTP_FALLBACK_HOST,
      port: env.SMTP_FALLBACK_PORT,
      user: env.SMTP_FALLBACK_USER,
      pass: env.SMTP_FALLBACK_PASS,
    },
  ]
    .filter((s) => s.host && s.user)
    .map((s) => ({
      name: s.name,
      from: env.MAIL_FROM || s.user,
      transport: createTransport({
        host: s.host,
        port: s.port,
        secure: s.port === 465,
        auth: { user: s.user, pass: s.pass },
        // Fail fast so the fallback gets a chance while the SOS is still fresh.
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
      }),
    }));

  if (!servers.length) {
    return {
      configured: false,
      async send(_to, subject) {
        logger.warn({ subject }, "SMTP not configured — email not sent");
        return false;
      },
    };
  }

  return {
    configured: true,
    servers: servers.map((s) => s.name),
    async send(to, subject, text) {
      for (const s of servers) {
        try {
          await s.transport.sendMail({ from: s.from, to, subject, text });
          if (s.name !== "primary") logger.warn({ subject }, "email sent via the fallback SMTP");
          return true;
        } catch (err) {
          logger.error({ err: err?.message, subject, server: s.name }, "email send failed");
        }
      }
      return false;
    },
  };
}
