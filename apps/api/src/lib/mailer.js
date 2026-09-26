import nodemailer from "nodemailer";
import { logger } from "./logger.js";

/**
 * Email sender (docs/02 §4.1: Nodemailer via SMTP). Returns { send(to, subject, text) }.
 * Without SMTP settings, emails are logged (subject only) and dropped, so local development and
 * tests work without a mail account.
 */
export function createMailer(env) {
  if (!env.SMTP_HOST || !env.SMTP_USER) {
    return {
      configured: false,
      async send(_to, subject) {
        logger.warn({ subject }, "SMTP not configured — email not sent");
        return false;
      },
    };
  }
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
  return {
    configured: true,
    async send(to, subject, text) {
      try {
        await transport.sendMail({ from: env.MAIL_FROM || env.SMTP_USER, to, subject, text });
        return true;
      } catch (err) {
        logger.error({ err, subject }, "email send failed");
        return false;
      }
    },
  };
}
