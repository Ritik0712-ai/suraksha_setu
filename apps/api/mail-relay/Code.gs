/**
 * Suraksha Setu — free email relay (Google Apps Script). docs/runbook.md §1.3.
 *
 * Why: Render's free plan blocks SMTP ports, and email services such as Brevo want a domain we
 * don't own. This script runs in the team's Google account and sends each email from Google's
 * own servers as that Gmail address, so Gmail's checks (SPF/DKIM/DMARC) pass. Free: about 100
 * recipients a day on a normal Gmail account — far more than the pilot needs.
 *
 * Set-up (once):
 *   1. script.google.com → New project → paste this file → Save.
 *   2. Project Settings → Script Properties → add RELAY_SECRET = a long random value
 *      (the same value goes into MAIL_RELAY_SECRET on the Render API service).
 *   3. Deploy → New deployment → type "Web app" → Execute as: Me → Who has access: Anyone
 *      → Deploy → allow access → copy the Web app URL (ends in /exec) into MAIL_RELAY_URL.
 * "Anyone" only means the URL can be called; without the secret every request is refused.
 */

const MAX_SUBJECT = 200;
const MAX_BODY = 5000;
const SENDER_NAME = "Suraksha Setu";
const EMAIL = /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[^\s@<>(),;:"]+$/;

function doPost(e) {
  try {
    const req = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const secret = PropertiesService.getScriptProperties().getProperty("RELAY_SECRET");
    if (!secret || !safeEqual(String(req.secret || ""), secret)) return reply(false, "forbidden");

    const to = String(req.to || "").trim();
    const subject = String(req.subject || "").slice(0, MAX_SUBJECT);
    const body = String(req.text || "").slice(0, MAX_BODY);
    if (!EMAIL.test(to) || to.length > 254) return reply(false, "bad_recipient");
    if (!subject || !body) return reply(false, "empty");
    if (MailApp.getRemainingDailyQuota() < 1) return reply(false, "quota");

    MailApp.sendEmail({ to: to, subject: subject, body: body, name: SENDER_NAME });
    return reply(true);
  } catch (err) {
    return reply(false, "error");
  }
}

/** A plain GET only says the relay is alive (no secret, sends nothing). */
function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ ok: true, relay: "up" })).setMimeType(
    ContentService.MimeType.JSON,
  );
}

function reply(ok, error) {
  const out = error ? { ok: ok, error: error } : { ok: ok };
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

/** Compares without stopping at the first different character. */
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
