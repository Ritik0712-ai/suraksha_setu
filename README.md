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
├── docs/               # docs 01–06
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
```

- `seed/jurisdictions.json` and `seed/departments.json` hold **placeholders** until field visit 1 confirms the names, the Gram Panchayat, the village centroid and the routing (docs/05 §11).
- `seed/admins.local.json` is git-ignored because it holds phone numbers. Admins must change the temporary password at first login.

## Checks (same as CI)

```bash
npm run lint            # ESLint (web + api)
npm run format:check    # Prettier
npm run i18n:check      # every key exists in both hi and en
npm test                # Vitest (web + api; API integration tests start an in-memory MongoDB)
npm run build -w apps/web

cd apps/ai && ruff check . && black --check . && pytest -q
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

| Method | Path                                            | Access                |
| ------ | ----------------------------------------------- | --------------------- |
| GET    | `/health`                                       | Public                |
| POST   | `/auth/register`, `/auth/login`                 | Public (rate-limited) |
| POST   | `/auth/refresh`                                 | Refresh cookie        |
| POST   | `/auth/logout`, `/auth/logout-all`              | Auth                  |
| POST   | `/auth/password/forgot`, `/auth/password/reset` | Public (rate-limited) |
| GET    | `/auth/me`                                      | Auth                  |
| PATCH  | `/users/me`                                     | Auth                  |
| PUT    | `/users/me/password`                            | Auth                  |
| DELETE | `/users/me` (password required, doc 05 §10)     | Auth                  |
| GET    | `/users/me/contacts`                            | Citizen               |
| POST   | `/users/me/contacts` (max 5)                    | Citizen               |
| PATCH  | `/users/me/contacts/:contactId`                 | Citizen               |
| DELETE | `/users/me/contacts/:contactId`                 | Citizen               |
| POST   | `/admin/users/:id/reset-code`                   | Admin (audited)       |
| GET    | `/jurisdictions?type=&q=`                       | Public                |

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
- ⏭ Phase 4A — Women's SOS — see doc 06 §4

## Frontend notes

- `npm run dev:web` → http://localhost:5173. In development, **/dev/components** shows every shared component; switch the language from the header to check both.
- Routes for modules that later phases build (SOS, complaints, schemes, …) already exist and show a "coming soon" page with the emergency helplines, so no link dead-ends.
- The access token lives only in memory (Zustand); language and text size are saved on the device. Server data goes through TanStack Query, and the API client refreshes once on `TOKEN_EXPIRED` and retries.
- Every visible string is in `apps/web/src/i18n/locales/{hi,en}/<namespace>.json`. Hindi is the default.
- React Router is on **v7** (doc 02 §3 says v6): v6 has an unpatched open-redirect advisory (GHSA-wrjc-x8rr-h8h6), fixed only in v7.
