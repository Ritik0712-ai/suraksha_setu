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
 * - MAIL_RELAY_URL + MAIL_RELAY_SECRET: our free Gmail relay (Apps Script) over HTTPS, tried
 *   first when set — Render's free plan blocks SMTP ports and needs no domain
 * - BREVO_API_KEY: Brevo's HTTPS API, tried next when set
 * - Primary:  SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS
 * - Fallback: SMTP_FALLBACK_HOST / _PORT / _USER / _PASS (e.g. Brevo), tried only when the
 *   primary fails — so an SOS email still goes out if Gmail throttles or rejects us.
 *
 * Without any SMTP settings, emails are logged (subject only) and dropped, so local development
 * and tests work without a mail account.
 */
/** "Suraksha Setu <a@b.in>" → { name, email } for Brevo's API. */
export function parseFrom(from) {
  const m = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(from ?? "");
  if (m) return { name: m[1].trim() || undefined, email: m[2].trim() };
  return { email: (from ?? "").trim() };
}

/** Brevo transactional email over HTTPS (port 443) — works where SMTP ports are blocked. */
function brevoApi(env, fetchImpl) {
  return {
    name: "brevo-api",
    async send({ to, subject, text }) {
      const res = await fetchImpl("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": env.BREVO_API_KEY,
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          sender: parseFrom(env.MAIL_FROM || env.SMTP_USER),
          to: [{ email: to }],
          subject,
          textContent: text,
        }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`Brevo API ${res.status} ${detail.slice(0, 200)}`);
      }
    },
  };
}

/**
 * Our Google Apps Script relay (apps/api/mail-relay/Code.gs) over HTTPS. The script sends from
 * Google's own servers as the team's Gmail address, so it needs no domain and passes Gmail's
 * sender checks. Apps Script answers 200 even on errors, so the JSON body decides.
 */
function appsScriptRelay(env, fetchImpl) {
  return {
    name: "gmail-relay",
    async send({ to, subject, text }) {
      const res = await fetchImpl(env.MAIL_RELAY_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ secret: env.MAIL_RELAY_SECRET, to, subject, text }),
        redirect: "follow", // /exec answers with a redirect to the script's output
        signal: AbortSignal.timeout(20_000),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.ok) {
        throw new Error(`mail relay ${res.status} ${body?.error ?? "no JSON reply"}`);
      }
    },
  };
}

export function createMailer(
  env,
  {
    createTransport = nodemailer.createTransport,
    resolve4 = (h) => dns.resolve4(h),
    fetchImpl = fetch,
  } = {},
) {
  const smtpServers = [
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
      async send({ to, subject, text }) {
        const transport = await this.transport();
        await transport.sendMail({ from: this.from, to, subject, text });
        transport.close?.();
      },
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
  const servers = [
    ...(env.MAIL_RELAY_URL && env.MAIL_RELAY_SECRET ? [appsScriptRelay(env, fetchImpl)] : []),
    ...(env.BREVO_API_KEY ? [brevoApi(env, fetchImpl)] : []),
    ...smtpServers,
  ];

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
          await s.send({ to, subject, text });
          if (s !== servers[0]) logger.warn({ subject, via: s.name }, "email sent via a backup");
          return true;
        } catch (err) {
          logger.error({ err: err?.message, subject, server: s.name }, "email send failed");
        }
      }
      return false;
    },
  };
}
