import { promises as dns } from "node:dns";
import { isIP } from "node:net";
import nodemailer from "nodemailer";
import { logger } from "./logger.js";

/**
 * The server's IPv4 address. Render's free instances have no IPv6 route, but nodemailer picks a
 * random address from the A and AAAA records, so some sends failed with ENETUNREACH. We connect
 * to an IPv4 address and still verify TLS against the real host name (servername).
 */
async function ipv4Of(host, resolve4) {
  if (isIP(host)) return host;
  try {
    const [addr] = await resolve4(host);
    return addr || host;
  } catch {
    return host; // let nodemailer resolve it as before
  }
}

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
export function createMailer(
  env,
  { createTransport = nodemailer.createTransport, resolve4 = (h) => dns.resolve4(h) } = {},
) {
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
      // A transport per send, pointed at a freshly resolved IPv4 address (low volume: SOS and
      // password emails), so a changed DNS record never sticks.
      async transport() {
        return createTransport({
          host: await ipv4Of(s.host, resolve4),
          port: s.port,
          secure: s.port === 465,
          tls: { servername: s.host },
          auth: { user: s.user, pass: s.pass },
          // Fail fast so the fallback gets a chance while the SOS is still fresh.
          connectionTimeout: 10_000,
          greetingTimeout: 10_000,
          socketTimeout: 20_000,
        });
      },
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
          const transport = await s.transport();
          await transport.sendMail({ from: s.from, to, subject, text });
          transport.close?.();
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
