# Suraksha Setu — Operations runbook

How to set up the external services, deploy, roll back, rotate keys and restore a backup
(docs/06 Phase 5 and Phase 7). Keep this file up to date whenever something here changes.

> Never paste real keys, passwords or phone numbers into this file, a commit, an issue or a chat.
> Secrets live only in the Vercel / Render dashboards, GitHub Actions secrets and your local `.env`.

---

## 1. External services (Phase 5)

Create **separate dev and prod credentials** for every service below (docs/02 SEC-11).

### 1.1 Cloudinary (task 5.1)

1. Create a free Cloudinary account. Copy the **API environment variable** (`cloudinary://<key>:<secret>@<cloud>`).
2. Set it as `CLOUDINARY_URL` on the API (Render). Set `APP_ENV=production` on production and `APP_ENV=preview` on any preview API, so photos land in `suraksha/<APP_ENV>/…`.
3. Nothing else to configure: uploads are signed by the API and limited to 1280 px and re-encoded, which strips EXIF/GPS.
4. **Check:** file a complaint with a phone photo, download the stored image from the Cloudinary media library and confirm it has no GPS data (e.g. `exiftool photo.jpg | grep -i gps` prints nothing). Delete a test photo from the portal flow and confirm it disappears from the media library.

### 1.2 Google Maps + Places (task 5.2)

Google Cloud Console → a project for Suraksha Setu → enable **Maps JavaScript API** and **Places API (New)**.

| Key | Where | Restrictions |
|---|---|---|
| Browser key | Vercel env `VITE_GOOGLE_MAPS_KEY` | Application restriction: **HTTP referrers** = the production and preview domains (`https://<app>.vercel.app/*`, custom domain). API restriction: **Maps JavaScript API** only. |
| Server key | Render env `GOOGLE_PLACES_KEY` | API restriction: **Places API (New)** only. Never put it in the web app. |

Then:
- **Quotas:** APIs & Services → Places API (New) → Quotas → set "requests per day" to about 300 (matches `PLACES_DAILY_LIMIT`).
- **Budget alert:** Billing → Budgets & alerts → a monthly budget (e.g. ₹500) with email alerts at 50/90/100%.
- Save screenshots of the key restrictions, quota and budget for the Phase II report.
- Without `VITE_GOOGLE_MAPS_KEY` the app shows location cards instead of maps; without `GOOGLE_PLACES_KEY` nearby services come only from the curated directory.

### 1.3 Email — Gmail + Brevo (task 5.3)

1. **Primary (Gmail):** turn on 2-step verification on the team Gmail account → Security → App passwords → create one for "Suraksha Setu". Set on the API: `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, `SMTP_USER=<gmail address>`, `SMTP_PASS=<app password>`, `MAIL_FROM="Suraksha Setu <gmail address>"`.
2. **Backup (Brevo, free tier):** create an account, verify the sender address, SMTP & API → SMTP → generate a key. Set `SMTP_FALLBACK_HOST=smtp-relay.brevo.com`, `SMTP_FALLBACK_PORT=587`, `SMTP_FALLBACK_USER=<Brevo login>`, `SMTP_FALLBACK_PASS=<SMTP key>`.
3. **Check:** trigger a test SOS with a contact that has an email, and a password-reset email. Both must arrive in the inbox, not spam. If they land in spam, mark "Not spam" once and add the sender to contacts; for production consider a custom domain with SPF/DKIM in Brevo.

### 1.4 Node ↔ AI service (task 5.4)

- Generate one key: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.
- Set the **same** value as `AI_INTERNAL_KEY` on the API and the AI service. Set `AI_BASE_URL` on the API to the AI service URL (no trailing slash).
- **Check (AI down → app still works):** stop/suspend the AI service, then file a complaint (category tiles appear, no error) and send a Sahayak message ("Sahayak is resting" appears). Start it again.

### 1.5 Socket.IO (task 5.5)

- Vercel can't proxy WebSockets, so set `VITE_SOCKET_URL=https://<api>.onrender.com` on Vercel and add the Vercel domain to `CORS_ORIGINS` on the API.
- **Check:** open the portal Live SOS page, trigger a drill SOS from a phone — the pin must appear in under 5 s. Turn the laptop's Wi-Fi off for 30 s and back on: the indicator goes "Reconnecting…" then "Live ●", and the list refreshes.

### 1.6 LLM for Sahayak (task 5.6)

1. Google AI Studio → create an API key in a project with billing (or use the free tier while developing).
2. On the AI service set `LLM_PROVIDER=gemini`, `LLM_API_KEY=<key>`, and optionally `LLM_MODEL` (default `gemini-3.5-flash`). Replies are capped at 800 output tokens.
3. Budget alert: Google Cloud Billing → Budgets & alerts on the same project (e.g. ₹500/month).
4. Grounding: create a **read-only** MongoDB user limited to the `schemes` collection (Atlas → Database Access → custom role with `find` on `<db>.schemes`) and set `MONGODB_URI_READONLY=mongodb+srv://<ro-user>:<pass>@<cluster>/<db>` on the AI service.
5. **Cost per 100 messages:** after some real use, open Portal → Analytics (admin) → "Sahayak usage": tokens per 100 replies × the model's price per token = cost per 100 messages. Record it in the Phase II report.
6. To switch provider: `LLM_PROVIDER=anthropic` with an Anthropic key (model default `claude-haiku-4-5-20251001`). `LLM_PROVIDER=fake` is for local development and E2E tests only.

### 1.7 Uptime monitoring (task 5.7)

UptimeRobot (free) → two HTTP(s) monitors, 5-minute interval, alert contact = the team email:
- API: `https://<api>.onrender.com/api/v1/health` (expects 200; 503 means the database is down).
- AI: `https://<ai>.onrender.com/health`.

The pings also keep free Render instances awake during development (docs/02 §9.2).

---

## 2. Deployment (Phase 7)

_See section 2 below — filled in with Phase 7._
