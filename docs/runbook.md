# Suraksha Setu — Operations runbook

How to set up the external services, deploy, roll back, rotate keys and restore a backup
(docs/06 Phase 5 and Phase 7). Keep this file up to date whenever something here changes.

> **Everything here is free, with no card or billing account anywhere** — a hard requirement of
> the project. Render free web services, Vercel Hobby, MongoDB Atlas M0, Cloudinary free, Gmail,
> Brevo free and the Gemini API free tier. Don't enable anything that asks for a card.

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

### 1.2 Maps — OpenStreetMap (free); Google Places not used (task 5.2)

Google Maps Platform only works with a billing account (a card), even inside its free monthly
credit, so the app uses **Leaflet + OpenStreetMap tiles** instead — no key, no account, no cost:

- Every map (SOS, tracking page, complaint pin, emergency map view, portal live SOS, admin pin
  pickers) is drawn with Leaflet from `tile.openstreetmap.org`, loaded only when a map is shown.
  OSM's [tile policy](https://operations.osmfoundation.org/policies/tiles/) asks for the visible
  "© OpenStreetMap" credit and a Referer header (both set in `components/ui/maps/leaflet.js`) and
  no heavy use — fine for a village pilot. If usage ever grows, switch `TILE_URL` to another free
  tile host.
- Offline, maps fall back to a location card with the coordinates. Every map keeps an **Open in
  Google Maps** link (a plain link that opens the Maps app on the phone — free, no API).
- No `GOOGLE_PLACES_KEY`, `PLACES_DAILY_LIMIT=0` → nearby services come only from the curated,
  phone-verified directory (A-10), which is the better source for Mahodiya anyway (docs/02 ADR-09).

### 1.3 Email — free Gmail relay (Apps Script), Brevo and SMTP as backups (task 5.3)

**Render's free plan blocks outbound SMTP ports** (25/465/587 — [Render changelog](https://render.com/changelog/free-web-services-will-no-longer-allow-outbound-traffic-to-smtp-ports)),
so on Render emails go over HTTPS. Email services (Brevo and others) now require a domain we
own for the sender, which costs money. So production uses a **Google Apps Script relay** in the
team's Google account: it sends from Google's own servers as that Gmail address, so Gmail's
sender checks pass. Free, no domain, about **100 recipients a day** on a normal Gmail account.

The mailer tries, in order: the relay (`MAIL_RELAY_URL` + `MAIL_RELAY_SECRET`) → Brevo's API
(`BREVO_API_KEY`) → SMTP. The first that works sends the email.

**Relay set-up (once, about 10 minutes):**

1. Make a secret: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.
2. Sign in to the Gmail account that should send the emails → https://script.google.com → **New project** → name it "Suraksha Setu mail relay" → replace the code with `apps/api/mail-relay/Code.gs` → **Save**.
3. **Project Settings** (gear) → **Script Properties** → **Add** → `RELAY_SECRET` = the secret from step 1 → **Save**.
4. **Deploy → New deployment** → type **Web app** → *Execute as*: **Me**; *Who has access*: **Anyone** → **Deploy** → **Authorize access** → choose the account → "Google hasn't verified this app" → **Advanced → Go to … (unsafe)** → **Allow**. (It's our own script asking to send email as you; the warning appears for every personal script.)
5. Copy the **Web app URL** (ends in `/exec`). On the Render API service set `MAIL_RELAY_URL` = that URL and `MAIL_RELAY_SECRET` = the secret. Never put the secret in git.
6. **Check:** open the URL in a browser → `{"ok":true,"relay":"up"}`. Then trigger a password-reset email for an account with an email address — it must arrive, sent from the Gmail address with the name "Suraksha Setu".
7. **Changing the script later:** Deploy → Manage deployments → edit → **New version** (keeps the same URL).

Brevo (optional, if an account is approved): Senders → confirm the `MAIL_FROM` address; API keys → set `BREVO_API_KEY`.

Gmail SMTP stays configured as the last backup (`SMTP_HOST=smtp.gmail.com`, `SMTP_USER`, `SMTP_PASS` = a Google **app password** from https://myaccount.google.com/apppasswords, `MAIL_FROM="Suraksha Setu <address>"`). It works locally and on hosts that allow SMTP; on Render it just times out and is skipped.
**Check before each review:** trigger a password-reset email and a drill SOS with a contact who has an email. Both must arrive in the inbox, not spam. If the relay's daily limit is hit, the mailer moves on to the backups, and SOS itself never depends on email (the SMS goes from the phone).

### 1.4 Node ↔ AI service (task 5.4)

- Generate one key: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.
- Set the **same** value as `AI_INTERNAL_KEY` on the API and the AI service. Set `AI_BASE_URL` on the API to the AI service URL (no trailing slash).
- **Check (AI down → app still works):** stop/suspend the AI service, then file a complaint (category tiles appear, no error) and send a Sahayak message ("Sahayak is resting" appears). Start it again.

### 1.5 Socket.IO (task 5.5)

- Vercel can't proxy WebSockets, so set `VITE_SOCKET_URL=https://<api>.onrender.com` on Vercel and add the Vercel domain to `CORS_ORIGINS` on the API.
- **Check:** open the portal Live SOS page, trigger a drill SOS from a phone — the pin must appear in under 5 s. Turn the laptop's Wi-Fi off for 30 s and back on: the indicator goes "Reconnecting…" then "Live ●", and the list refreshes.

### 1.6 LLM for Sahayak (task 5.6)

1. Google AI Studio (aistudio.google.com) → **Get API key** → create a key in a new project. Don't link a billing account: the key then stays on the **free tier** (rate-limited per minute and per day, never charged).
2. On the AI service set `LLM_PROVIDER=gemini` and `LLM_API_KEY=<key>`. Default model `gemini-3.5-flash-lite` (on the free tier it answered every test in 1–4 s), falling back to `gemini-flash-latest` when a call fails — but only while ≥ 10 s of the budget remain, because Google rejects per-request deadlines under 10 s. Every failed attempt is logged with its code (e.g. `ServerError 503 UNAVAILABLE`). Override with `LLM_MODEL` / `LLM_FALLBACK_MODELS` (comma-separated). Replies are capped at 800 output tokens; the whole call has `LLM_TIMEOUT_S` (12 s), inside the API's 15 s.
3. Free-tier limits: if Google's daily limit is reached, Sahayak shows "resting" and the rest of the app works. Our own limit (30 messages per user per day) keeps usage low.
4. **Privacy on the free tier:** Google may use free-tier prompts to improve its products. The prompt holds only what the user types (a letter includes the name they enter) plus our scheme data and village name — never their phone number. The Privacy page (S-32) and Sahayak's disclaimer tell users this and ask them not to type private details.
5. Grounding: create a **read-only** MongoDB user limited to the `schemes` collection (Atlas → Database Access → custom role with `find` on `<db>.schemes`) and set `MONGODB_URI_READONLY=mongodb+srv://<ro-user>:<pass>@<cluster>/<db>` on the AI service.
6. **Usage:** Portal → Analytics (admin) → "Sahayak usage" shows messages and tokens per 100 replies — on the free tier the cost is ₹0; record the token numbers in the Phase II report to show what a paid tier *would* cost.
7. To switch provider: `LLM_PROVIDER=anthropic` with an Anthropic key (model default `claude-haiku-4-5-20251001`). `LLM_PROVIDER=fake` is for local development and E2E tests only.

### 1.7 Uptime monitoring and keeping the API awake (task 5.7)

Render's free services sleep after 15 minutes without traffic; waking takes about a minute.

- **The API keeps itself awake in the daytime:** every 10 minutes from 06:30 to 23:10 IST it calls
  its own public URL (`src/jobs/keepAwake.js`, using `RENDER_EXTERNAL_URL`, which Render sets).
  At night it sleeps; the first visitor of the morning wakes it.
- **`.github/workflows/keep-alive.yml`** also pings `/api/v1/health` every 10 minutes in the daytime
  and is the uptime monitor (a failed run emails the repository owner). GitHub runs quiet
  repositories' schedules late or skips them (on 27–28 Sep it ran 4 times in 20 hours), so it is
  only a backup morning wake-up — never rely on it alone.
- **The AI service wakes on demand — from the browser:** Render only starts a sleeping free
  service for traffic from outside Render. A call from our API (also on Render) gets an instant
  502 and the AI service stays asleep (this broke Sahayak on 1 Oct). So opening Sahayak or the
  complaint wizard, and sending a Sahayak message, makes the browser call `/ai-wake`, a Vercel
  rewrite to the AI service's public `/health` (`apps/web/vercel.json`). A message that finds it
  still asleep waits for it (up to about 70 s, with a "Sahayak is waking up" note) and then asks
  again. `/api/v1/health` does **not** touch the AI
  service (that would keep it awake all day); use `/api/v1/health?ai=1` to check it.
- **Free hours budget:** Render gives 750 free instance hours per workspace per month. The API's
  daytime window uses ≈ 520; the AI service uses the rest while it's awake. Don't make the window
  24 h and don't add UptimeRobot monitors — either would use up the hours and Render would suspend
  both services until the next month.
- At night the API sleeps; the first request then takes about a minute. An SOS still opens the SMS
  app and 112 on the phone immediately, and the app retries the server for 2 minutes.
- GitHub pauses scheduled workflows after 60 days without commits — re-enable it in Actions.

---

## 2. Deployment (Phase 7)

```
Browser ──HTTPS──▶ Vercel (web, apps/web) ──/api/* rewrite──▶ Render: suraksha-setu-api ──▶ MongoDB Atlas (Mumbai)
   └──────── WebSocket (VITE_SOCKET_URL) ─────────────────────▶        │  X-Internal-Key
                                                                       ▼
                                                         Render: suraksha-setu-ai ──▶ LLM API · schemes (read-only)
```

**Live setup (27 Sep 2026), all free:** Render workspace "Ritik" → `suraksha-setu-api`
(https://suraksha-setu-api-jrcl.onrender.com) and `suraksha-setu-ai`
(https://suraksha-setu-ai.onrender.com); Vercel project `suraksha-setu` → **https://suraksha-setu-zeta.vercel.app**; Atlas M0.

To rebuild from scratch: **Atlas → Render → Vercel → wire the URLs → set up the database → smoke
test.** If Render gives the API a different URL, use it everywhere
`suraksha-setu-api-jrcl.onrender.com` appears — `apps/web/vercel.json` (rewrite **and**
Content-Security-Policy), `.github/workflows/keep-alive.yml` and this file.

### 2.1 MongoDB Atlas — production (task 7.3)

1. Create a **separate Atlas project** "suraksha-setu-prod" (dev and prod never share a cluster, SEC-11). Cluster: **M0 (Free)**, provider AWS, region **Mumbai (ap-south-1)**. M0 is free forever (512 MB storage — far more than the pilot needs); it has no automated backups, which is why the nightly backup workflow exists (§2.9).
2. Database Access → three users with long random passwords:

   | User | Role | Used by |
   |---|---|---|
   | `app` | `readWrite` on the app database | API `MONGODB_URI` |
   | `ai-ro` | custom role: `find` on `<db>.schemes` only | AI `MONGODB_URI_READONLY` |
   | `backup-ro` | `read` on the app database | GitHub secret `MONGODB_URI_BACKUP` |

3. Network Access: Render's free instances have no fixed IP, so allow `0.0.0.0/0` and rely on the strong passwords + TLS (Atlas default).
4. Connection strings always include the database name: `mongodb+srv://app:<pass>@<cluster>/suraksha_setu?retryWrites=true&w=majority`.

### 2.2 Render — API and AI service (task 7.2)

1. Render → **New → Blueprint** → connect `Ritik0712-ai/suraksha_setu` → it reads `render.yaml` and proposes `suraksha-setu-api` and `suraksha-setu-ai` (Singapore, free plan).
2. Fill in every `sync: false` value it asks for (tables in §1 say where each comes from). Leave `AI_BASE_URL`, `CORS_ORIGINS` and `PUBLIC_APP_URL` for step 2.4 if you don't know the URLs yet — the API still boots.
3. Generated for you: `JWT_ACCESS_SECRET`, `REFRESH_TOKEN_PEPPER`, `AI_INTERNAL_KEY` (copied to the AI service automatically) and `DJANGO_SECRET_KEY`.
4. **Model:** until CNN v1 is published as a GitHub Release (`ml/README.md`), leave `MODEL_URL` / `MODEL_CARD_URL` empty — the build skips the download and complaints use manual categories. After the release, set both and **Manual Deploy → Clear build cache & deploy**.
5. Checks: `https://suraksha-setu-api-jrcl.onrender.com/api/v1/health?ai=1` → `{"status":"ok","db":"up","ai":"up"}` (without `?ai=1`, `ai` is `unchecked`); `https://suraksha-setu-ai.onrender.com/health` → `{"status":"ok"}`; `…/internal/health` without the key → **401**.

Notes: the API has no build step (plain Node ESM), so it starts with `npm run start -w apps/api` rather than `node dist/server.js` (docs/02 §9.2). Both services build from the repo root because they read `shared/constants.json`.

### 2.3 Vercel — web app (task 7.1)

1. Vercel → **Add New → Project** → import the repo. **Root Directory: `apps/web`** (keep "Include files outside the root directory" on — Vite reads `shared/`). Framework preset: Vite. Build `npm run build`, output `dist` (defaults).
2. Environment variables (Production, and Preview with preview values):

   | Variable | Value |
   |---|---|
   | `VITE_API_BASE` | `/api/v1` |
   | `VITE_SOCKET_URL` | `https://suraksha-setu-api-jrcl.onrender.com` (WebSockets can't go through the rewrite) |
   | `VITE_APP_ENV` | `production` / `preview` |
   | `HUSKY` | `0` |

3. `apps/web/vercel.json` does the rest: `/api/*` → Render (so the refresh cookie is first-party, docs/02 §6.2), SPA fallback, security headers (HSTS, CSP, frame-deny), long-lived caching for hashed `/assets/*` and `no-cache` for the service worker.
4. **Content-Security-Policy (SEC-09):** allows only our origin, the Render API (https + wss), Cloudinary images, OpenStreetMap tiles and Google Fonts. `script-src` is `'self'` only (no inline or eval); `style-src` keeps `'unsafe-inline'` because MUI injects its styles at runtime. The E2E tests serve the build with the same headers and fail on any CSP violation, so a new external host has to be added here on purpose.

### 2.4 Wire the URLs together

| Where | Variable | Value |
|---|---|---|
| Render API | `CORS_ORIGINS` | `https://<app>.vercel.app` (+ custom domain, comma-separated) |
| Render API | `PUBLIC_APP_URL` | `https://<app>.vercel.app` (SOS track links, emails) |
| Render API | `AI_BASE_URL` | `https://suraksha-setu-ai.onrender.com` |
| Vercel | `VITE_SOCKET_URL` | the API URL |

Redeploy the API after changing its variables (Render does this automatically) and the web app after changing `VITE_*` (they're baked in at build time).

### 2.5 First-time database setup (task 7.4)

**On Render (no shell on the free plan) — the way it was done:** on `suraksha-setu-api` set
`DB_BOOTSTRAP=1` and `BOOTSTRAP_ADMINS=[{"name":"…","phone":"9XXXXXXXXX"}]` (one entry per team
admin) → it redeploys and `apps/api/src/scripts/bootstrap.js` runs migrations, indexes,
jurisdictions + departments, admins (temporary passwords appear once in that deploy's log) and the
20 draft schemes before the server starts → then **delete both variables** (the phones shouldn't
stay in the dashboard). Every step skips what already exists, so a second run changes nothing.

**Or from a laptop:**

Run from a laptop, with the **prod** connection string only in your shell for these commands (never in `.env` files you might commit, never in chat):

```bash
cd apps/api
export MONGODB_URI='mongodb+srv://app:…@…/suraksha_setu'   # prod, this shell only
npm run db:migrate
npm run db:indexes              # production runs with autoIndex off
npm run db:seed                 # jurisdictions + departments (placeholders until field visit 1 confirms them)
cp seed/admins.example.json seed/admins.local.json   # one entry per team member (git-ignored)
npm run db:seed:admins          # prints each temporary password ONCE — hand them over in person
npm run db:seed:schemes         # 20 schemes as drafts; R4 verifies and publishes in the portal (A-09)
npm run db:seed:emergency       # only phone-verified rows
unset MONGODB_URI
```

Each admin logs in and is forced to change the temporary password (A-14).

### 2.6 Smoke test after every production deploy

On a real phone, in Hindi, over mobile data (≈ 10 minutes; record failures as P0 bugs):

1. `/` loads; the emergency bar calls 112; `/emergency` shows helplines (also in airplane mode after one visit).
2. Log in as a test citizen → Home shows the name → reload → still logged in.
3. SOS drill (tell your contacts first): countdown → SMS app opens pre-filled → the portal's Live SOS shows the pin in < 5 s → the track link opens on a second phone → "I am safe".
4. Complaint with a photo → AI suggestion (or tiles if no model yet) → complaint number → the portal can verify it.
5. Schemes list and one scheme detail; the eligibility checker gives results.
6. Sahayak answers a question (or says "resting" if no LLM key) and "bachao" shows the SOS card.
7. `/api/v1/health` shows `db: up`.

### 2.7 Roll back

- **Web:** Vercel → Deployments → pick the last good one → **Promote to Production** (instant; no rebuild).
- **API / AI:** Render → service → Deploys → last good deploy → **Rollback**. Auto-deploy stays on, so also revert the bad commit on `main` (`git revert <sha>` → push) or the next push redeploys it.
- **Database:** migrations have a `down` (`npm run db:migrate:status`, then `npx migrate-mongo down -f migrate-mongo-config.js` for the last one). Data loss → restore (§2.9).
- Tell the team in the WhatsApp group what was rolled back and why; add a line to the bug tracker.

### 2.8 Rotate keys and secrets

Rotate at once if a secret may have leaked (pasted in a chat, committed, a laptop lost); otherwise before the pilot and after it.

| Secret | How | Effect on users |
|---|---|---|
| `JWT_ACCESS_SECRET` | Render → env → generate new → save | Access tokens fail; apps refresh silently within one request |
| `REFRESH_TOKEN_PEPPER` | same | **Everyone is logged out** (do it at night; citizens need their password for the next SOS login) |
| `AI_INTERNAL_KEY` | set the same new value on API and AI (API first, then AI; ~1 min of "AI unavailable") | Complaints fall back to tiles for a minute |
| Atlas passwords | Atlas → Database Access → edit → update `MONGODB_URI` / `_READONLY` / backup secret | Brief restart |
| Cloudinary, SMTP, Brevo, Places, Maps, LLM keys | create a new key in the provider console → update env → delete the old key | None |
| `BACKUP_PASSPHRASE` | GitHub → Settings → Secrets → update; keep the old one until its backups expire (30 days) | None |

If a key was committed to git, rotating it is the fix — rewriting history doesn't un-leak it.

### 2.9 Backups and the restore drill (task 7.7)

- **Turn backups on:** add the GitHub secrets `MONGODB_URI_BACKUP` (the `backup-ro` user) and `BACKUP_PASSPHRASE`. Until both exist the nightly job only prints a warning and skips (it shows as a green run). Then Actions → "Nightly DB backup" → **Run workflow** once and check the artifact exists.
- M0 has no snapshots of its own, so this nightly dump (GitHub Actions, free for public repositories) is the backup. Artifacts are kept for 30 days.
- **Drill (once before the pilot):** create a scratch database on the dev cluster → restore last night's dump into it (commands in README "Backups") → point a local API at it → log in as an admin and open a complaint → drop the scratch database. Record the date and the time it took in the Phase II report.

### 2.10 Pilot and demo weeks (task 7.6) — still free

No upgrades: the project stays on the free plans.

- Ten minutes before a demo, open `https://suraksha-setu-api-jrcl.onrender.com/api/v1/health?ai=1` (wakes both services; wait for `ai: up`) and open Sahayak once. During the demo, opening Sahayak or the complaint wizard also wakes the AI service in the background.
- For the pilot, the daytime keep-alive covers normal hours; tell the authority user the portal may take a minute to open late at night.
- Watch the free usage once a week: Render → workspace "Ritik" → Billing shows the free instance hours used this month (must stay under 750); Atlas → M0 storage; Cloudinary → credits; Google AI Studio → usage.
- Record a backup demo video in case the venue network fails (docs/06 8.7).

### 2.11 Custom domain (task 7.5, optional)

**Skipped** — a domain costs money. The free `*.vercel.app` address is used. (If a free domain is ever sponsored:)
Buy a cheap `.in` domain → Vercel → Project → Domains → add it and set the DNS records Vercel shows → HTTPS is automatic. Then add it to `CORS_ORIGINS`, `PUBLIC_APP_URL` (if it becomes the main one) and the Maps browser-key referrers. Don't use a name that looks like a government site (docs/04 §1.3).

### 2.12 Releases (task 7.8)

Tag the commit that was demoed, and add a section to `CHANGELOG.md` first:

```bash
git tag -a v0.1.0 -m "Progress Review-1"    # v0.5.0 Review-II · v1.0.0 pilot · v1.1.0 final
git push origin v0.1.0
```

Then GitHub → Releases → draft a release from the tag with the changelog section. CNN models are
released separately (`ml/README.md`) because their tags carry the model version.
