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

```
Browser ──HTTPS──▶ Vercel (web, apps/web) ──/api/* rewrite──▶ Render: suraksha-setu-api ──▶ MongoDB Atlas (Mumbai)
   └──────── WebSocket (VITE_SOCKET_URL) ─────────────────────▶        │  X-Internal-Key
                                                                       ▼
                                                         Render: suraksha-setu-ai ──▶ LLM API · schemes (read-only)
```

Order the first time: **Atlas → Render → Vercel → wire the URLs → set up the database → smoke test.**
Everything below uses the service names from `render.yaml`; if Render gives you a different URL
(the name was taken), use yours everywhere `suraksha-setu-api.onrender.com` appears — including
`apps/web/vercel.json` (rewrite **and** Content-Security-Policy).

### 2.1 MongoDB Atlas — production (task 7.3)

1. Create a **separate Atlas project** "suraksha-setu-prod" (dev and prod never share a cluster, SEC-11). Cluster: region **Mumbai (ap-south-1)**; M0 while testing, **Flex or M10** for the pilot (automated backups, docs/02 §5).
2. Database Access → three users with long random passwords:

   | User | Role | Used by |
   |---|---|---|
   | `app` | `readWrite` on the app database | API `MONGODB_URI` |
   | `ai-ro` | custom role: `find` on `<db>.schemes` only | AI `MONGODB_URI_READONLY` |
   | `backup-ro` | `read` on the app database | GitHub secret `MONGODB_URI_BACKUP` |

3. Network Access: Render's free and starter instances have no fixed IP, so allow `0.0.0.0/0` and rely on the strong passwords + TLS (Atlas default). On a paid Render plan, list Render's outbound IPs for the Singapore region instead.
4. Connection strings always include the database name: `mongodb+srv://app:<pass>@<cluster>/suraksha_setu?retryWrites=true&w=majority`.

### 2.2 Render — API and AI service (task 7.2)

1. Render → **New → Blueprint** → connect `Ritik0712-ai/suraksha_setu` → it reads `render.yaml` and proposes `suraksha-setu-api` and `suraksha-setu-ai` (Singapore, free plan).
2. Fill in every `sync: false` value it asks for (tables in §1 say where each comes from). Leave `AI_BASE_URL`, `CORS_ORIGINS` and `PUBLIC_APP_URL` for step 2.4 if you don't know the URLs yet — the API still boots.
3. Generated for you: `JWT_ACCESS_SECRET`, `REFRESH_TOKEN_PEPPER`, `AI_INTERNAL_KEY` (copied to the AI service automatically) and `DJANGO_SECRET_KEY`.
4. **Model:** until CNN v1 is published as a GitHub Release (`ml/README.md`), leave `MODEL_URL` / `MODEL_CARD_URL` empty — the build skips the download and complaints use manual categories. After the release, set both and **Manual Deploy → Clear build cache & deploy**.
5. Checks: `https://suraksha-setu-api.onrender.com/api/v1/health` → `{"status":"ok","db":"up","ai":"up"}`; `https://suraksha-setu-ai.onrender.com/health` → `{"status":"ok"}`; `…/internal/health` without the key → **401**.

Notes: the API has no build step (plain Node ESM), so it starts with `npm run start -w apps/api` rather than `node dist/server.js` (docs/02 §9.2). Both services build from the repo root because they read `shared/constants.json`.

### 2.3 Vercel — web app (task 7.1)

1. Vercel → **Add New → Project** → import the repo. **Root Directory: `apps/web`** (keep "Include files outside the root directory" on — Vite reads `shared/`). Framework preset: Vite. Build `npm run build`, output `dist` (defaults).
2. Environment variables (Production, and Preview with preview values):

   | Variable | Value |
   |---|---|
   | `VITE_API_BASE` | `/api/v1` |
   | `VITE_SOCKET_URL` | `https://suraksha-setu-api.onrender.com` (WebSockets can't go through the rewrite) |
   | `VITE_GOOGLE_MAPS_KEY` | browser key from §1.2 (referrer-restricted) — optional |
   | `VITE_APP_ENV` | `production` / `preview` |
   | `HUSKY` | `0` |

3. `apps/web/vercel.json` does the rest: `/api/*` → Render (so the refresh cookie is first-party, docs/02 §6.2), SPA fallback, security headers (HSTS, CSP, frame-deny), long-lived caching for hashed `/assets/*` and `no-cache` for the service worker.
4. **Content-Security-Policy (SEC-09):** allows only our origin, the Render API (https + wss), Cloudinary images, and the Google Maps allowlist from Google's CSP guide. That guide requires `'unsafe-inline'` and `'unsafe-eval'` in `script-src` for Maps; a nonce-based strict CSP would need server rendering, which a static site doesn't have. The E2E tests serve the build with the same headers and fail on any CSP violation, so a new external host has to be added here on purpose.

### 2.4 Wire the URLs together

| Where | Variable | Value |
|---|---|---|
| Render API | `CORS_ORIGINS` | `https://<app>.vercel.app` (+ custom domain, comma-separated) |
| Render API | `PUBLIC_APP_URL` | `https://<app>.vercel.app` (SOS track links, emails) |
| Render API | `AI_BASE_URL` | `https://suraksha-setu-ai.onrender.com` |
| Vercel | `VITE_SOCKET_URL` | the API URL |
| Google Cloud | browser key referrers | the Vercel domain(s) |

Redeploy the API after changing its variables (Render does this automatically) and the web app after changing `VITE_*` (they're baked in at build time).

### 2.5 First-time database setup (task 7.4)

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
- On Flex/M10 Atlas also takes automated snapshots; keep the nightly dump anyway (a copy outside Atlas).
- **Drill (once before the pilot):** create a scratch database on the dev cluster → restore last night's dump into it (commands in README "Backups") → point a local API at it → log in as an admin and open a complaint → drop the scratch database. Record the date and the time it took in the Phase II report.

### 2.10 Pilot and demo weeks (task 7.6)

- ~1 week before: API (and ideally AI) `plan: starter` in `render.yaml` → commit → Render re-syncs the Blueprint; Atlas → Flex/M10; confirm the budget alerts (Maps, LLM) and the UptimeRobot monitors.
- Record a backup demo video in case the venue network fails (docs/06 8.7).
- After the pilot, switch back to `free` to stop the charges.

### 2.11 Custom domain (task 7.5, optional)

Buy a cheap `.in` domain → Vercel → Project → Domains → add it and set the DNS records Vercel shows → HTTPS is automatic. Then add it to `CORS_ORIGINS`, `PUBLIC_APP_URL` (if it becomes the main one) and the Maps browser-key referrers. Don't use a name that looks like a government site (docs/04 §1.3).

### 2.12 Releases (task 7.8)

Tag the commit that was demoed, and add a section to `CHANGELOG.md` first:

```bash
git tag -a v0.1.0 -m "Progress Review-1"    # v0.5.0 Review-II · v1.0.0 pilot · v1.1.0 final
git push origin v0.1.0
```

Then GitHub → Releases → draft a release from the tag with the changelog section. CNN models are
released separately (`ml/README.md`) because their tags carry the model version.
