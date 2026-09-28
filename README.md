# सुरक्षा सेतु · Suraksha Setu

A bilingual (Hindi + English), mobile-first web app for rural communities that brings together:

- one-tap SOS for women's safety
- AI-assisted civic complaints
- government-scheme guidance
- a blood-donor directory
- nearby emergency services
- a Hindi writing assistant (Sahayak)

The pilot village is **Mahodiya, Sehore district, Madhya Pradesh**.

> Suraksha Setu is an **independent student project** of VIT Bhopal (DSN3099 — Engineering Projects in Community Service). It is **not** a government service and is not affiliated with any government body.

## Documents

Read these before writing code. Each task in the plan says which sections apply.

| Doc                                                            | What it decides                                                      |
| -------------------------------------------------------------- | -------------------------------------------------------------------- |
| [01 PRD](docs/01_PRD.md)                                       | What we build and why (modules, requirements, user stories, metrics) |
| [02 Technical Requirements](docs/02_Technical_Requirements.md) | Stack, architecture, **APIs**, auth, security, deployment            |
| [03 App Flow](docs/03_App_Flow.md)                             | Every screen and **behaviour** (wins on behaviour)                   |
| [04 UI/UX Design Brief](docs/04_UI_UX_Design_Brief.md)         | **Visuals**, tokens, components (wins on visuals)                    |
| [05 Backend Schema](docs/05_Backend_Schema.md)                 | **Data** model, permissions, retention (wins on data)                |
| [06 Implementation Plan](docs/06_Implementation_Plan.md)       | Phases, task IDs, owners, review milestones                          |

## Repository layout

```
suraksha-setu/
├── apps/
│   ├── web/            # React 18 + Vite + MUI v5 PWA (citizen app + authority portal)
│   ├── api/            # Node.js 22 + Express 4 + Mongoose 8 (the only service the browser calls)
│   └── ai/             # Python 3.11 + Django 5 + DRF (CNN classifier, Sahayak) — internal only
├── shared/
│   └── constants.json  # every enum, helplines, blood compatibility — read by all 3 apps
├── ml/                 # complaint-photo CNN training (Colab) → .tflite release asset
├── docs/               # docs 01–06, runbook.md (setup, deploy, rollback), test-plan.md
├── e2e/                # Playwright end-to-end tests
├── render.yaml         # Render Blueprint: API + AI service
└── .github/workflows/  # CI
```

**Rule:** enum values (categories, statuses, roles, blood groups, …) come only from `shared/constants.json`. Never hard-code them anywhere else.

## Run it locally

### Prerequisites

- Node.js **22** (LTS) and npm 10+
- Python **3.11**
- MongoDB: either a free Atlas **dev** cluster or local Mongo (`docker run -d -p 27017:27017 mongo:7`). The API still starts without one, but `/health` reports `db: "down"`.

### 1. Install

```bash
git clone https://github.com/Ritik0712-ai/suraksha_setu.git
cd suraksha_setu
npm install                       # web + api (npm workspaces) and the git hooks

cd apps/ai
python3.11 -m venv .venv
source .venv/bin/activate         # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
cd ../..
```

### 2. Configure

Copy each `.env.example` and fill in the values. Never commit a real `.env`.

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
cp apps/ai/.env.example  apps/ai/.env
```

For local work you only need `MONGODB_URI` (api) and the **same** `AI_INTERNAL_KEY` in both `apps/api/.env` and `apps/ai/.env`.

### 3. Start the three services (three terminals)

```bash
npm run dev:api                                  # http://localhost:5000/api/v1/health
npm run dev:web                                  # http://localhost:5173 (proxies /api → :5000)

cd apps/ai && source .venv/bin/activate
set -a && source .env && set +a
python manage.py runserver 8000                  # internal only; needs X-Internal-Key
```

### 4. Set up a local database (first time)

```bash
cd apps/api
npm run db:migrate              # run pending migrations (none yet — see migrations/README.md)
npm run db:indexes              # create every index (production runs with autoIndex off)
npm run db:seed                 # pilot jurisdictions + departments and routing (idempotent)
cp seed/admins.example.json seed/admins.local.json   # add each team member's name + phone
npm run db:seed:admins          # prints each admin's temporary password ONCE
npm run db:seed:schemes         # 20 schemes as drafts (needs an admin; verify + publish in the portal)
npm run db:seed:emergency       # optional: seed/emergency_services.csv, verified rows only
```

- `seed/jurisdictions.json` and `seed/departments.json` hold **placeholders** until field visit 1 confirms the names, the Gram Panchayat, the village centroid and the routing (docs/05 §11).
- `seed/admins.local.json` is git-ignored because it holds phone numbers. Admins must change the temporary password at first login.

## Checks (same as CI)

```bash
npm run lint            # ESLint (web + api)
npm run format:check    # Prettier
npm run i18n:check      # every key exists in both hi and en
npm test                # Vitest (web + api; API integration tests start an in-memory MongoDB)
npm run test:coverage -w apps/api   # API tests + coverage gate (lines ≥ 85%, branches ≥ 75%)
npm run build -w apps/web
npm audit --omit=dev --audit-level=high
npm run e2e             # Playwright, 360 × 640, Hindi — see e2e/README.md

cd apps/ai && ruff check . && black --check . && pytest -q && pip-audit -r requirements.txt
ruff check ../../ml && black --check ../../ml
```

The API integration tests download a `mongod` binary from `fastdl.mongodb.org` on first run. If that host is blocked on your network, point `MONGOMS_SYSTEM_BINARY` at any local `mongod` 7+ binary. `npm run test:unit -w apps/api` runs only the tests that don't need a database.

A pre-commit hook (husky + lint-staged) runs ESLint and Prettier on staged JS/JSON/MD/CSS files. Python files are checked in CI.

## Working on a task

1. Pick one task ID from [doc 06](docs/06_Implementation_Plan.md) (for example `4A.7`).
2. Branch: `feat/<task-id>-<short-name>`.
3. Follow doc 03 for behaviour, 04 for visuals, 05 for data and 02 for APIs. Quote the section you implemented in the PR description.
4. Add every user-visible string to **both** `apps/web/src/i18n/locales/hi` and `.../en`.
5. Add tests. Open a PR, get at least 1 review, and make sure CI is green.

## API so far

All routes are under `/api/v1`. Responses use `{ data }` on success and `{ error: { code, message, details? } }` on failure (doc 02 §7.1). Error messages come back in Hindi by default, or English with `Accept-Language: en`.

| Method         | Path                                                                                                        | Access                              |
| -------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| GET            | `/health`                                                                                                   | Public                              |
| POST           | `/auth/register`, `/auth/login`                                                                             | Public (rate-limited)               |
| POST           | `/auth/refresh`                                                                                             | Refresh cookie                      |
| POST           | `/auth/logout`, `/auth/logout-all`                                                                          | Auth                                |
| POST           | `/auth/password/forgot`, `/auth/password/reset`                                                             | Public (rate-limited)               |
| GET            | `/auth/me`                                                                                                  | Auth                                |
| PATCH          | `/users/me`                                                                                                 | Auth                                |
| PUT            | `/users/me/password`                                                                                        | Auth                                |
| DELETE         | `/users/me` (password required, doc 05 §10)                                                                 | Auth                                |
| GET            | `/users/me/contacts`                                                                                        | Citizen                             |
| POST           | `/users/me/contacts` (max 5)                                                                                | Citizen                             |
| PATCH          | `/users/me/contacts/:contactId`                                                                             | Citizen                             |
| DELETE         | `/users/me/contacts/:contactId`                                                                             | Citizen                             |
| POST           | `/admin/users/:id/reset-code`                                                                               | Admin (audited)                     |
| GET            | `/jurisdictions?type=&q=`                                                                                   | Public                              |
| POST           | `/sos` (never rate-limited)                                                                                 | Citizen                             |
| GET            | `/sos/mine?open=1`                                                                                          | Citizen                             |
| POST           | `/sos/:id/location`, `/sos/:id/resolve`                                                                     | Owner                               |
| GET            | `/sos/:id`                                                                                                  | Owner / in-scope staff              |
| GET            | `/sos/active?window=24h`                                                                                    | Authority, Admin                    |
| POST           | `/sos/:id/acknowledge`, `/sos/:id/close`                                                                    | In scope (audited)                  |
| POST           | `/sos/:id/reveal-phone`                                                                                     | In scope (audited)                  |
| GET            | `/track/:token`                                                                                             | Public                              |
| POST           | `/complaints/classify` (multipart `image`)                                                                  | Citizen                             |
| GET            | `/complaints/classify/warmup`                                                                               | Citizen                             |
| GET            | `/complaints/route-preview?category=&lat=&lng=`                                                             | Citizen                             |
| POST           | `/complaints` (10 per day)                                                                                  | Citizen                             |
| GET            | `/complaints/mine?status=open\|resolved\|rejected&page=`                                                    | Citizen                             |
| GET            | `/complaints/:id`                                                                                           | Owner / in-scope staff              |
| POST           | `/complaints/:id/reopen`                                                                                    | Owner                               |
| GET            | `/complaints` (filters, sort, pages), `/complaints/export.csv`                                              | Authority, Admin (scoped)           |
| PATCH          | `/complaints/:id/status`, `/assign`, `/category`                                                            | Authority, Admin (audited)          |
| POST           | `/complaints/:id/notes`, `/resolution-photo`, `/reveal-phone`                                               | Authority, Admin (audited)          |
| GET            | `/schemes?category=&level=&q=`, `/schemes/:slug`                                                            | Public                              |
| POST           | `/schemes/eligibility`                                                                                      | Public (answers kept only if asked) |
| GET/PUT/DELETE | `/users/me/saved-schemes/:schemeId`                                                                         | Citizen                             |
| GET            | `/emergency/helplines`, `/emergency/nearby?type=&lat=&lng=`                                                 | Public                              |
| GET/PUT/DELETE | `/donors/me`, PATCH `/donors/me/availability`                                                               | Citizen                             |
| GET            | `/donors/search?bloodGroup=&radiusKm=&includeCompatible=`                                                   | Citizen (masked)                    |
| POST           | `/donors/:id/reveal` (10 per day, logged)                                                                   | Citizen                             |
| GET            | `/notifications`, POST `/notifications/read`                                                                | Signed in                           |
| GET/POST       | `/chat/sessions` (start: `mode`, `schemeId?`, `letterType?`; list: last 20)                                 | Citizen                             |
| GET/DELETE     | `/chat/sessions/:id`                                                                                        | Owner                               |
| POST           | `/chat/sessions/:id/messages` (30 per day; emergency words answered before the LLM)                         | Owner                               |
| PUT            | `/chat/sessions/:id/messages/:messageId/letter` (S-26 edit)                                                 | Owner                               |
| GET            | `/admin/overview`, `/admin/analytics`, `/admin/meta`                                                        | Authority, Admin (scoped)           |
| CRUD           | `/admin/users`, `/admin/departments`, `/admin/jurisdictions`, `/admin/schemes`, `/admin/emergency-services` | Admin (audited)                     |
| GET            | `/admin/audit-logs`                                                                                         | Admin                               |
| POST           | `/events`, `/client-errors`                                                                                 | Public (rate-limited)               |

Real-time events use Socket.IO on the API server (`/socket.io`, access token in the handshake): `sos:new`, `sos:location`, `sos:updated`, `complaint:new`, `complaint:updated` to officers in scope and admins; `sos:acknowledged`, `notification:new` to the user (doc 02 §7.4). Jobs close SOS alerts with no update for 6 hours (every 10 min) and delete complaint photos never attached to a complaint within 24 h (hourly).

Access tokens last 15 minutes and are kept in memory by the client. The refresh token is an httpOnly cookie on `/api/v1/auth`, rotated on every use. Reusing an old one logs out that whole login (doc 02 §6.2, doc 05 §7).

## Backups

While the production database is on Atlas M0 (no automated backups), `.github/workflows/db-backup.yml` dumps it every night at 02:00 IST, encrypts the archive with AES-256, and keeps it as a private workflow artifact for 30 days (doc 02 §9.6). It needs two repository secrets: `MONGODB_URI_BACKUP` (a **read-only** user) and `BACKUP_PASSPHRASE` (keep a copy outside GitHub). Without them the job skips with a warning. Run it by hand from the Actions tab.

To restore, download the artifact, then:

```bash
gpg --decrypt suraksha-setu-<date>.archive.gz.gpg > dump.archive.gz   # asks for the passphrase
mongorestore --uri="<target MONGODB_URI>" --archive=dump.archive.gz --gzip --drop
```

Test a restore into a scratch database once before the pilot (doc 06 task 7.7).

## Status

- ✅ Phase 0 — setup
- ✅ Phase 1 — authentication (tasks 1.1–1.10)
- ✅ Phase 2 — database: all 19 models, migrations setup, seeds, jurisdiction resolver, department routing, complaint numbers, nightly backups (tasks 2.1–2.7)
- ✅ Phase 3 — core UI: design system, citizen + portal shells, auth/profile/contacts screens, system screens, route guards, PWA (tasks 3.1–3.10)
- ✅ Phase 4A — Women's SOS: trigger + countdown, SMS/email/real-time alerts, live tracking page, "I am safe", auto-close, fake call (tasks 4A.1–4A.10)
- ✅ Phase 4B — AI civic complaints: training pipeline, `/internal/classify` on LiteRT, photo upload + AI suggestion, routing, complaint numbers, "my complaints", detail with timeline, reopen, uploads cleanup (tasks 4B.1–4B.9; the real dataset and CNN v1 training run on Colab — see `ml/README.md`)
- ✅ Phase 4C — schemes: catalogue + search, detail with trust line, offline copies, eligibility checker, saved schemes with document checklist, update notifications (tasks 4C.1–4C.7; the 20 schemes are imported as **drafts** until verified)
- ✅ Phase 4D — emergency: helplines offline, curated directory (CSV import) with Google Places fallback, list + map (tasks 4D.1–4D.4)
- ✅ Phase 4E — authority portal: overview, complaints table + management (every transition from doc 05 §5.6.1), live SOS map + drawer, analytics + CSV, users, schemes editor with rules builder, emergency directory, departments + routing gaps, areas tree, audit log, citizen notifications + status emails (tasks 4E.1–4E.7)
- ✅ Phase 4F — blood donors: donor profile (consent, 90-day gap, availability), compatible nearby search with masked phones, reveal with a 10/day limit and a log (tasks 4F.1–4F.4)
- ✅ Phase 4G — Sahayak: LLM provider adapter (Gemini default, Anthropic, offline `fake`), grounding on published schemes, emergency pre-check, chat API with limits, S-24/S-25/S-26 with letters (edit, copy, WhatsApp, print), 50-question evaluation set (tasks 4G.1–4G.7)
- ✅ Phase 5 — integrations: SMTP fallback, Places daily budget, Cloudinary folders per environment, uptime endpoints, LLM cost in analytics; account setup in [docs/runbook.md](docs/runbook.md) §1 (tasks 5.1–5.7)
- ✅ Phase 6 — testing: Playwright E2E for every core flow with axe accessibility scans, permissions-matrix tests, API coverage gate and `pip-audit`; manual device, field and SOS-drill plans in [docs/test-plan.md](docs/test-plan.md)
- 🟡 Phase 7 — deployment, **free plans only**: web https://suraksha-setu-zeta.vercel.app (Vercel Hobby), API + AI on Render free (Singapore), daytime keep-alive; runbook in [docs/runbook.md](docs/runbook.md) §2. Waiting for the Atlas M0 database and the free keys (Gemini, Cloudinary, Gmail) (tasks 7.1–7.8)
- 🟡 Phase 8 — polish: faster first load (socket.io after login, Schemes list fetched alongside its code), A+ text-size and offline checks in E2E, Hindi review sheet (`npm run i18n:sheet -w apps/web`), report screenshots (`npm run screenshots`), [demo script](docs/demo-script.md), [report material](docs/report-material.md). **Left for the team:** native Hindi review (8.1), re-verifying schemes and the emergency directory (8.6), the backup demo video (8.7) and pilot results

## SOS notes

- **The SMS app needs a tap.** Browsers only open `sms:` links from a user gesture, so after the countdown auto-sends (or on a phone with no SIM) S-07 shows a big red "Send SMS to contacts" button — one tap opens the SMS app with the message ready. Emails and the authority alert go out regardless.
- **Offline:** if the server can't be reached, the SMS still opens with the contacts cached on the phone, and S-07 retries every 10 s for 2 minutes. A known citizen who opens the app while the server is down still gets the full SOS (name, role and contacts are cached on the device; logout clears them).
- **Tracking link** (`/track/<token>`): shows only the first name, location and status; the token is derived from the SOS id with an HMAC (only its hash is stored), so the owner can reopen their link; location is never shown after the SOS ends.
- **Maps:** free OpenStreetMap maps via Leaflet (no key); offline, a location card with coordinates and an "Open in Google Maps" link is shown.
- In production the web app needs `VITE_SOCKET_URL` pointing at the Render API (Vercel can't proxy WebSockets). Locally, Vite proxies `/socket.io`.

## Complaint notes

- **Photos:** the phone compresses the photo (≤ 1280 px, ≤ 500 KB), the API checks the real type by its first bytes (JPEG/PNG/WebP, max 5 MB) and stores it on Cloudinary (`CLOUDINARY_URL`), limited to 1280 px and re-encoded, which strips EXIF/GPS. Without `CLOUDINARY_URL` in development, photos go to `apps/api/.uploads/` and are served at `/api/v1/files/<name>`.
- **AI is optional.** The API gives the AI service 8 s (one quick retry on a dropped connection). If it's down, slow or has no model, the citizen just picks the category from the tiles. The AI suggestion is stored on the upload and copied into the complaint server-side, so the phone can't fake it; `categorySource` is `ai_accepted` only when the citizen kept a suggestion with confidence ≥ 0.60.
- **Routing** uses the seeded departments (docs/02 §8.3); the review step shows where it will go.
- **Local AI:** `apps/ai/core/tests/fixtures/test_model.tflite` is a 2 KB stand-in with the real input/output contract (mostly red photo → road damage, green → garbage, blue → streetlight). To try the whole flow without the real model:

  ```bash
  cd apps/ai && source .venv/bin/activate
  DJANGO_DEBUG=true AI_INTERNAL_KEY=<same as api> AI_ALLOWED_IMAGE_HOSTS=localhost \
    MODEL_PATH=$PWD/core/tests/fixtures/test_model.tflite python manage.py runserver 8000
  ```

- **Real model:** trained on Colab from `ml/` and published as a GitHub Release; the AI service downloads it at build time (`scripts/fetch_model.py`, `MODEL_URL` + `MODEL_CARD_URL`). See [`ml/README.md`](ml/README.md).

## Integration notes (Phase 5)

- **Email:** tried in order until one works — our free Gmail relay over HTTPS (Google Apps Script, `apps/api/mail-relay/Code.gs`, set `MAIL_RELAY_URL` + `MAIL_RELAY_SECRET`), Brevo's HTTPS API (`BREVO_API_KEY`), then SMTP (`SMTP_*`, `SMTP_FALLBACK_*`) for local work. Render's free plan blocks SMTP ports, so production uses the relay (docs/runbook.md §1.3).
- **Google Places:** server key only (`GOOGLE_PLACES_KEY`), called only when the curated directory has fewer than 3 results, and capped in code at `PLACES_DAILY_LIMIT` calls per IST day (default 300) on top of the Cloud Console quota and budget alert.
- **Cloudinary:** folders are `suraksha/<APP_ENV>/<purpose>` so development, preview and production never mix.
- **Uptime:** the API has `GET /api/v1/health` (`{ status, db, ai }`); the AI service has a key-less `GET /health` (`{ status: "ok" }` only) for UptimeRobot and Render.
- **LLM cost:** A-06 Analytics shows admins Sahayak usage — messages, letters, emergency cards, and input/output tokens per 100 replies (multiply by the provider's price for the cost per 100 messages).
- Setting up each account (keys, restrictions, quotas, alerts) is in [docs/runbook.md](docs/runbook.md).

## Sahayak notes

- **Flow:** browser → `POST /api/v1/chat/sessions/:id/messages` (auth, 30 messages per IST day, last 10 turns) → Django `POST /internal/sahayak/reply` → LLM. The LLM gets our rules and the relevant **published** schemes in the system prompt; the user's words only ever travel as user turns (doc 02 SEC-16). It has no tools and no database write access. Scheme cards are limited to slugs we sent, so it can't link to made-up pages.
- **Emergency first:** `shared/emergencyCheck.js` (word list in `constants.json → sahayak`) runs in the browser (the SOS card shows instantly) and in the API (no LLM call). Strong phrases ("bachao", "मार रहा", "accident") always match; weak ones ("help", "मदद") only when the whole message is ≤ 4 words, so "help me write a letter" still reaches Sahayak. A false alarm has a "No, I'm not in danger" button that resends with the check skipped.
- **Letters:** the letter session asks one thing at a time (doc 03 S-25), then returns `{ to, subject, body, applicantName, includeMobile }`. The API adds the date (IST), the village, and the phone number only if the user said yes — the phone never goes to the LLM. S-26 prints only the letter (A4, 2 cm margins) via the browser, so Hindi renders correctly. Recipient lines per letter type are drafts in `apps/ai/core/sahayak/prompt.py` for R4 to confirm.
- **Configure** (apps/ai): `LLM_PROVIDER=gemini`, `LLM_API_KEY`, optional `LLM_MODEL` (default `gemini-3.5-flash-lite`, with `gemini-flash-latest` as the fallback), and `MONGODB_URI_READONLY` (a read-only user with the database name in the path). Without a key, Sahayak shows "resting" and the rest of the app works. For local work without a key: `LLM_PROVIDER=fake`.
- **Evaluation (4G.7):** `apps/ai/eval/sahayak_eval_set.json` has 50 questions (25 scheme, 15 letter, 10 tricky). `python scripts/run_sahayak_eval.py` runs them against the configured LLM and writes a report plus a CSV with a `human_ok` column for the team review before the pilot. Emergency detection is checked in CI (`apps/api/test/unit/sahayak.test.js`).

## Schemes, emergency and donor notes

- **Schemes are drafts until verified.** `npm run db:seed:schemes` imports the 20 schemes from doc 05 §11.4 as drafts with general text only (no amounts or limits from memory). R4 checks each against the official source in the portal (A-09: edit → **Mark verified today & publish**). A scheme can't be published without a verification date, and one older than 90 days shows a warning on S-15. Seeded rules carry an "always check at the office" note, so the checker answers _maybe_ until that note is removed after verification.
- **Emergency directory:** only services confirmed by phone or a visit go in (`verified_on`). Import them with `npm run db:seed:emergency` (copy `seed/emergency_services.template.csv`) or the portal's **Import CSV** (all rows validated first; nothing is written if one is wrong). With fewer than 3 curated results nearby, the API asks Google Places (`GOOGLE_PLACES_KEY`, server-side) and stores nothing from it.
- **Donors:** search never returns phone numbers; `/reveal` does, at most 10 new donors per IST day per person, each logged (kept 180 days). Donors see how many people viewed their number this month and can hide themselves at once.
- **Portal real-time:** the overview, complaints and live SOS pages update on socket events and refetch after a reconnect; the live SOS list polls every 30 s while the socket is down.
- **Bundle size:** translation namespaces used only by some screens (`portal`, `schemes`, `blood`, `emergency`, `notifications`) load with those screens, keeping the citizen app's first download under 250 KB gzipped. Charts (MUI X Charts) load only on A-06.

## Frontend notes

- `npm run dev:web` → http://localhost:5173. In development, **/dev/components** shows every shared component; switch the language from the header to check both.
- Routes for modules that later phases build (SOS, complaints, schemes, …) already exist and show a "coming soon" page with the emergency helplines, so no link dead-ends.
- The access token lives only in memory (Zustand); language and text size are saved on the device. Server data goes through TanStack Query, and the API client refreshes once on `TOKEN_EXPIRED` and retries.
- Every visible string is in `apps/web/src/i18n/locales/{hi,en}/<namespace>.json`. Hindi is the default.
- React Router is on **v7** (doc 02 §3 says v6): v6 has an unpatched open-redirect advisory (GHSA-wrjc-x8rr-h8h6), fixed only in v7.
