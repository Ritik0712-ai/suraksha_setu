# Suraksha Setu — Implementation Plan

| | |
|---|---|
| **Document** | 06 — Step-by-step Implementation Plan |
| **Version** | 1.0 (draft for team review) |
| **Date** | 26 September 2026 |
| **Team** | 5 members (lead: Ritik Agarwal) |
| **Course** | DSN3099 — a one-year project across Semester 5 (Phase I) and Semester 6 (Phase II) |
| **Related docs** | 01 PRD · 02 TRD · 03 App Flow · 04 UI/UX Brief · 05 Backend Schema |

This plan turns docs 01–05 into ordered work. It starts from **where the project is today** (see the interim supervisor report of July 2026), applies the supervisor's changes (rural focus, Hindi, government-style UI, scam module removed, Schemes + Sahayak added), and lines the work up with the DSN3099 review dates.

> **Dates:** week numbers start on **Monday 28 September 2026 (S5-W1)**. Semester 6 weeks are counted from the first teaching week in January 2027 (S6-W1). Replace the "~" review dates with the official ones as soon as they're announced, and re-check the plan around CAT/FAT exam weeks.

---

## 1. Where we are today

| Area | Status (from the July 2026 interim report) | What changes now |
|---|---|---|
| Repo, Vite, Node scaffold, GitHub | ✅ Done | Restructure into the monorepo (doc 02, section 2.4) |
| MongoDB schema (6 collections) | ✅ Done (old design) | Migrate to the new schema (doc 05, section 14) |
| Auth (register/login/JWT, bcrypt) | ✅ Done | Phone login, refresh rotation, roles, lockout, reset codes |
| Profile + SOS contacts | 🟡 90% | Rename to emergencyContacts, add relation, max 5 |
| SOS trigger backend | ✅ Done | Add tracking token, location updates, statuses, sockets |
| SOS email alerts | 🟡 60% | Finish + add the on-phone SMS path |
| Cloudinary upload | ✅ Done | Keep; add compression and the uploads collection |
| Django AI service | 🟡 70% | Add internal key, LiteRT serving, Sahayak endpoint |
| CNN training | 🟡 55% | Retarget to 7 rural classes; add handpump data |
| NLP scam model | 🟡 65% | ❌ **Stop. Module removed.** Archive the code in a branch. |
| Blood donor backend | ✅ Done | Add eligibility, masking, reveal log |
| Emergency services (Places) | 🟡 80% | Add the curated directory + helplines |
| React auth pages | ✅ Done | Restyle to the new theme + Hindi |
| SOS / complaint / blood UIs | 🟡 50% / 40% / 10% | Rebuild on the new design system |
| Scam checker UI | 5% | ❌ Remove |
| Authority dashboard, analytics | ⬜ 5% / 0% | Build (Semester 6 mostly) |
| Schemes, Sahayak, i18n | ⬜ New | Build |
| Deployment | ⬜ 0% | **Move earlier:** deploy by S5-W6 for Review-1 |

---

## 2. Timeline at a glance

```
SEMESTER 5 (Phase I — target ≥ 40% of total work)
S5-W1  28 Sep ─ Phase 0 Setup ▸ Phase 1 Auth ▸ plan field visit
S5-W2  05 Oct ─ Phase 1 done ▸ Phase 2 Database ▸ Phase 3 Core UI starts ▸ FIELD VISIT 1
S5-W3  12 Oct ─ Phase 3 Core UI ▸ 4A SOS backend ▸ CNN v1 training
S5-W4  19 Oct ─ 4A SOS screens ▸ 4C scheme content (first 10)
S5-W5  26 Oct ─ 4B Complaint wizard + AI ▸ 4D Emergency numbers + nearby
S5-W6  02 Nov ─ 4C Schemes browse/detail ▸ minimal portal (A-01, A-04) ▸ DEPLOY v0.1
S5-W7  09 Nov ─ Testing + fixes ▸ Phase I report ▸ demo rehearsal
~S5-W8        ─ ★ PROGRESS REVIEW-1 (before FAT) + PHASE I REPORT
               (exam weeks: buffer only)

SEMESTER 6 (Phase II)
S6-W1..W3     ─ 4E Portal complaint management ▸ eligibility checker ▸ scheme manager
S6-W4..W5     ─ 4F Blood donors ▸ analytics v1 ▸ FIELD VISIT 2 (usability round 1)
~S6-W6        ─ ★ PROGRESS REVIEW-II (week after CAT I)
S6-W6..W9     ─ 4G Sahayak (Q&A → letters) ▸ PWA offline ▸ remaining admin ▸ CNN v2
S6-W10..W13   ─ 4-week PILOT IN MAHODIYA ▸ polish ▸ accessibility ▸ translations
~S6-W13/14    ─ ★ FINAL REVIEW-III + INDIVIDUAL FINAL REPORTS
```

---

## 3. Team roles (5 members)

Each member owns a clearly separate area so that every **individual final report** (a DSN3099 requirement) has distinct, provable contributions. Fill in the names in the "Member" column.

| Role | Member | Owns | Main phases |
|---|---|---|---|
| **R1 — Tech lead & backend** | Ritik Agarwal | Architecture, Node API, auth, SOS backend, integrations, deployment, code review | 0, 1, 2, 4A, 5, 7 |
| **R2 — Frontend lead** | _______ | Design system implementation, citizen app screens, i18n, PWA | 3, 4A–4D UI, 8 |
| **R3 — AI/ML** | _______ | CNN dataset + training + LiteRT export, Django AI service, Sahayak orchestration | 4B (AI), 4G |
| **R4 — Content, research & field** | _______ | Field visits, scheme catalogue (bilingual), emergency directory, Hindi copy review, Sahayak letter templates, consent forms | 4C, 4D data, field work, 8 |
| **R5 — Portal & QA** | _______ | Authority/admin portal screens, analytics, test plans, E2E tests, accessibility audit, pilot data collection | 4E, 4F UI, 6 |

**Ways of working**
- GitHub Projects board with one card per task below. Branch per task (`feat/sos-track-page`), PR with at least 1 review, CI green before merge.
- Weekly 30-minute team sync + an update in the log book (DSN3099 needs records of ≥ 6 hours/week of team activity; keep a shared log sheet with date, member, hours, work done).
- Definition of done for any task: code merged, works in Hindi and English, passes tests, matches doc 03/04, and deployed to preview.

---

## 4. Phases in detail

Legend: ✅ done · 🟡 partly done · ⬜ to do

### Phase 0 — Setup (S5-W1) · Owner R1

**Goal:** a clean monorepo that three services and five people can work in without stepping on each other.

| # | Task | Status |
|---|---|---|
| 0.1 | Restructure the repo into `apps/web`, `apps/api`, `apps/ai`, `shared/`, `docs/` | ⬜ |
| 0.2 | Create `shared/constants.json` (all enums from doc 05, section 4 + helplines + blood compatibility) and import it in all three apps | ⬜ |
| 0.3 | Remove the scam module (UI routes, API routes, Django app, `scam_reports`). Archive in branch `archive/scam-module`. | ⬜ |
| 0.4 | ESLint + Prettier (web/api), Ruff + Black (ai), EditorConfig, commit hooks (lint-staged) | ⬜ |
| 0.5 | `.env.example` for each app (doc 02, section 9.3). Separate Atlas projects for dev and prod. | ⬜ |
| 0.6 | GitHub Actions CI: lint + test + build for all apps on every PR | ⬜ |
| 0.7 | Copy docs 01–06 into `docs/`. Add a README with setup steps. | ⬜ |
| 0.8 | GitHub Projects board with all tasks from this plan | ⬜ |

**Deliverables:** monorepo on `main`, CI passing, README that lets a new member run everything locally in < 30 minutes.

---

### Phase 1 — Authentication (S5-W1 → W2) · Owner R1

**Goal:** secure, phone-based auth with roles and scoping (doc 02, section 6; doc 05, section 7).

| # | Task | Status |
|---|---|---|
| 1.1 | Register/login with phone (E.164) + password; email optional | 🟡 (email-based today) |
| 1.2 | Access token (15 min, in memory) + rotating refresh cookie + `sessions` collection with reuse detection | ⬜ |
| 1.3 | Vercel rewrite `/api/*` → Render (same-origin cookies) | ⬜ |
| 1.4 | `requireAuth`, `requireRole`, `assertInScope` middleware/helpers | 🟡 |
| 1.5 | Lockout after 10 failures, rate limits on auth routes | ⬜ |
| 1.6 | Logout, logout-all, change password (`tokenVersion`) | ⬜ |
| 1.7 | Password reset: email link + admin-issued 6-digit code | ⬜ |
| 1.8 | Consent capture at registration | ⬜ |
| 1.9 | Seed script: admin accounts for each team member (`mustChangePassword`) | ⬜ |
| 1.10 | Tests: register/login/refresh/reuse/lockout/role checks (Supertest + mongodb-memory-server) | ⬜ |

**Deliverables:** `/auth/*` endpoints complete, tests passing, Postman collection updated.

---

### Phase 2 — Database (S5-W2) · Owner R1 (with R4 for seed content)

**Goal:** the full schema from doc 05 in place, with migrated data and seed data.

| # | Task | Status |
|---|---|---|
| 2.1 | Mongoose models for all 19 collections with validation and indexes | 🟡 (6 old models) |
| 2.2 | `migrate-mongo` set up. Write migrations 001–006 for the old → new changes (doc 05, section 14). | ⬜ |
| 2.3 | `npm run db:indexes` script (`autoIndex: false` in prod) | ⬜ |
| 2.4 | Seed: jurisdictions (MP → Sehore → block → Mahodiya), departments + routing, national helplines | ⬜ |
| 2.5 | Jurisdiction resolver (point → village) and department routing function, with unit tests | ⬜ |
| 2.6 | `counters` helper for `SS-YYYY-NNNNNN` complaint numbers | ⬜ |
| 2.7 | Nightly `mongodump` GitHub Action (while on M0) | ⬜ |

**Deliverables:** `db:migrate` and `db:seed` run cleanly on an empty database, and an ER diagram in the repo matches doc 05.

---

### Phase 3 — Core UI (S5-W2 → W4) · Owner R2 (R4 for Hindi copy)

**Goal:** the design system and app shell from doc 04, working in Hindi and English, on which every module is built.

| # | Task | Status |
|---|---|---|
| 3.1 | MUI theme + CSS tokens (doc 04, section 11). Self-hosted Noto Sans + Noto Sans Devanagari. | ⬜ |
| 3.2 | react-i18next setup: `hi` default, namespaces per module, missing-key CI check | ⬜ |
| 3.3 | Citizen shell: tricolour strip, header (language toggle, text size, bell), emergency bar, footer disclaimer, bottom nav, desktop header nav | ⬜ |
| 3.4 | Portal shell: sidebar, top bar, drawer on mobile | ⬜ |
| 3.5 | Shared components: buttons (all variants), tiles, cards, chips, status chips, empty state, error card, skeletons, toast, dialogs/bottom sheets, wizard frame | ⬜ |
| 3.6 | Screens: S-01 Language, S-02 Home (both states), S-03 Login, S-04 Register, S-05/05b Reset, S-27 Profile, S-28 Contacts, S-31 About, S-32 Privacy | 🟡 (auth pages exist, need restyle) |
| 3.7 | System screens X-01…X-06, route guards, offline banner | ⬜ |
| 3.8 | Axios client with refresh-on-401, TanStack Query setup, Zustand stores | 🟡 |
| 3.9 | Logo + custom icons (handpump, Sahayak) — R4/R2 | ⬜ |
| 3.10 | Basic PWA: manifest, icons, precached shell | ⬜ |

**Deliverables:** a Storybook-style component page (or a `/dev/components` route in dev builds) showing every component in both languages, and all listed screens working at 360 px and 1366 px.

---

### Phase 4 — Main features

#### 4A — Women's SOS (S5-W3 → W5) · Owners R1 (backend), R2 (UI)

| # | Task | Status |
|---|---|---|
| 4A.1 | `POST /sos` with jurisdiction resolve, track token, contacts snapshot, one-active-SOS rule | 🟡 |
| 4A.2 | Location updates, resolve (with FALSE_ALARM < 60 s), acknowledge, close, auto-close job | ⬜ |
| 4A.3 | Email alerts to contacts (Nodemailer) — finish and test | 🟡 60% |
| 4A.4 | Socket.IO server + rooms; `sos:new/location/updated`, `sos:acknowledged` | ⬜ |
| 4A.5 | S-06 SOS trigger + countdown (GPS fallback chain, `sms:` link, offline retry) | 🟡 |
| 4A.6 | S-07 SOS active (checklist, 30 s updates, Wake Lock, WhatsApp/copy fallback) | ⬜ |
| 4A.7 | S-08 ended, S-30 public track page | ⬜ |
| 4A.8 | S-09 fake call (setup, ringing, in call, offline assets) | ⬜ |
| 4A.9 | Contacts cached on the device for offline SOS | ⬜ |
| 4A.10 | Tests: API + E2E happy path + "API down" path | ⬜ |

**Deliverables:** SOS works end to end on a real phone: countdown → SMS app opens pre-filled → email arrives → track link works → "I am safe" ends it. Measured timings recorded for the report.

#### 4B — AI Civic Complaints (S5-W3 → W7) · Owners R3 (AI), R1 (API), R2 (UI)

| # | Task | Status |
|---|---|---|
| 4B.1 | Dataset for 7 classes: RDD2022 (roads), Open Images (garbage), custom (streetlight, waterlogging, **handpump/water supply**, encroachment, other). Target ≥ 300 images per class after cleaning. Photos from field visit 1 (with consent). | 🟡 |
| 4B.2 | Train CNN v1 (MobileNetV2, 2-phase) on Colab. Report accuracy, confusion matrix, per-class F1. | 🟡 55% |
| 4B.3 | Export to `.tflite` (float16). Write `model_card.json`. Upload as a GitHub Release asset. | ⬜ |
| 4B.4 | Django `/internal/classify` with LiteRT, `X-Internal-Key`, health endpoint; pytest | 🟡 |
| 4B.5 | Node `POST /complaints/classify` (Multer → Cloudinary → AI, 8 s timeout, `uploads` doc) | 🟡 (upload done) |
| 4B.6 | `POST /complaints` (routing, counter, timeline, notification, `complaint:new`) | ⬜ |
| 4B.7 | `GET /complaints/mine`, `GET /complaints/:id` (public timeline), reopen | ⬜ |
| 4B.8 | S-10 wizard (4 steps, client compression, manual fallback), S-11, S-12, S-13 | 🟡 40% |
| 4B.9 | Uploads cleanup job | ⬜ |
| 4B.10 | CNN v2 retrain with pilot/field photos + authority corrections (Semester 6, S6-W8) | ⬜ |

**Deliverables:** a citizen can photograph a problem and get an AI category in < 3 s (warm), and the complaint is visible with a timeline. CNN evaluation report (accuracy ≥ 87% target, honest per-class results).

#### 4C — Government Schemes (content S5-W4 → W6; checker S6-W1 → W3) · Owners R4 (content), R2 (UI), R1 (API)

| # | Task | Status |
|---|---|---|
| 4C.1 | Collect and verify the first **10 schemes** from official sources (doc 05, section 11.4), both languages, with source + verified date. Use a shared sheet → import script. | ⬜ |
| 4C.2 | `GET /schemes`, `GET /schemes/:slug` with in-memory cache | ⬜ |
| 4C.3 | S-14 list (search, categories), S-15 detail (trust line, sections, disclaimer) | ⬜ |
| 4C.4 | Offline cache of the last 10 viewed schemes | ⬜ |
| 4C.5 | **Semester 6:** rules for each scheme (5.8.2), `POST /schemes/eligibility`, S-16 checker, S-17 results | ⬜ |
| 4C.6 | **Semester 6:** saved schemes + document checklist (S-18), `version` update notifications | ⬜ |
| 4C.7 | **Semester 6:** extend the catalogue to 20 schemes | ⬜ |

**Deliverables:** Phase I — browse + detail for 10 verified schemes. Phase II — eligibility checker over 20 schemes, with a test table (sample answers → expected results) signed off by R4.

#### 4D — Nearby Emergency Services (S5-W5 → W6) · Owners R1 (API), R2 (UI), R4 (data)

| # | Task | Status |
|---|---|---|
| 4D.1 | Helplines from `shared/constants.json`, offline | ⬜ |
| 4D.2 | Curated Sehore directory: collect, **phone-verify**, enter via the seed CSV | ⬜ |
| 4D.3 | `GET /emergency/nearby` (curated first, Places fallback, only `place_id` stored) | 🟡 80% (Places only) |
| 4D.4 | S-20 list view (+ map view toggle in Semester 6) | 🟡 |

**Deliverables:** S-20 shows helplines offline and correct nearest services for Mahodiya's location.

#### 4E — Authority Dashboard (minimal S5-W6; full S6-W1 → W5) · Owners R5 (UI), R1 (API)

| # | Task | Status |
|---|---|---|
| 4E.1 | **Phase I minimum:** A-01 Overview (KPIs), A-04 Live SOS map with real-time pins, A-05 acknowledge/close | ⬜ |
| 4E.2 | A-02 complaints table (filters in URL, pagination), A-03 management (transitions from doc 05, section 5.6.1, notes, assign, resolution photo, re-categorise) | ⬜ |
| 4E.3 | Citizen notifications (S-29) + `complaint:updated` events + optional emails | ⬜ |
| 4E.4 | A-07 users (create authority accounts, reset codes), A-11 departments, A-12 jurisdictions | ⬜ |
| 4E.5 | A-08/A-09 scheme manager with the bilingual editor and rules builder (so R4 stops using the sheet import) | ⬜ |
| 4E.6 | A-10 emergency directory, A-13 audit log | ⬜ |
| 4E.7 | A-06 analytics v1 (charts from doc 03) + CSV export | ⬜ |

**Deliverables:** an authority user can take a complaint from SUBMITTED to RESOLVED, and the citizen sees every step. Live SOS shows within 5 s.

#### 4F — Blood Donor Directory (S6-W4 → W5) · Owners R5 (UI), R1 (API)

| # | Task | Status |
|---|---|---|
| 4F.1 | Upgrade the donor model: `eligibleFrom`, `displayName`, consent, availability | 🟡 (backend exists) |
| 4F.2 | Search with compatibility + `$geoNear`, masked results | 🟡 |
| 4F.3 | Reveal endpoint with a 10/day limit + log + donor count | ⬜ |
| 4F.4 | S-21 search, S-23 donor profile | 🟡 10% |

**Deliverables:** search → reveal → call works; limits enforced; donors can hide themselves.

#### 4G — Sahayak AI Chatbot (S6-W6 → W9) · Owners R3 (AI service), R1 (API), R2 (UI), R4 (prompts/templates)

| # | Task | Status |
|---|---|---|
| 4G.1 | LLM provider adapter in Django (default Gemini Flash-tier). Env-configurable. | ⬜ |
| 4G.2 | System prompt + scheme grounding (load published schemes, pick relevant ones by category/keywords) | ⬜ |
| 4G.3 | Node emergency keyword pre-check (Hindi/English/Hinglish list) | ⬜ |
| 4G.4 | Chat API (sessions, messages, 30/day limit, 10-message history, TTL) | ⬜ |
| 4G.5 | S-24 home, S-25 chat (intents, cards, chips, errors) | ⬜ |
| 4G.6 | Letter mode: 4 templates (R4 drafts the formal Hindi + English formats), structured `letter` output, S-26 preview + edit + print CSS + WhatsApp share | ⬜ |
| 4G.7 | **Evaluation set:** 50 test questions (25 scheme, 15 letters, 10 tricky/out-of-scope/emergency) with expected behaviour. Run before the pilot; target ≥ 90% acceptable answers, 100% on emergency detection. | ⬜ |

**Deliverables:** Sahayak answers scheme questions from our data and produces printable letters. The evaluation report goes into the final report.

---

### Phase 5 — Integrations (runs alongside Phase 4) · Owner R1

| # | Integration | When | Done when |
|---|---|---|---|
| 5.1 | Cloudinary (upload preset, EXIF strip, folders per env, deletion) | S5-W3 | Upload + delete tested; EXIF confirmed removed |
| 5.2 | Google Maps JS (browser key, referrer-restricted) + Places (server key, quotas, budget alert) | S5-W5 | Keys restricted; quota + budget alert screenshots saved |
| 5.3 | SMTP (Gmail app password; Brevo fallback) | S5-W4 | SOS + reset emails delivered, not in spam |
| 5.4 | Node ↔ Django (internal key, timeouts, fallbacks) | S5-W5 | AI down → complaint flow still works (tested) |
| 5.5 | Socket.IO (auth handshake, rooms, reconnect) | S5-W4 | Pin appears < 5 s; reconnect works after network drop |
| 5.6 | LLM API (key, budget alert, max tokens) | S6-W6 | Cost per 100 messages measured and recorded |
| 5.7 | UptimeRobot on `/health` for both services | S5-W6 | Alerts reach the team email |

---

### Phase 6 — Testing (continuous; focused weeks S5-W7, S6-W9, S6-W12) · Owner R5

| Level | Tools | Scope | Target |
|---|---|---|---|
| Unit | Vitest (web/api), pytest (ai) | Routing, eligibility engine, transitions, compatibility, jurisdiction resolver, i18n helpers | ≥ 60% API service coverage; eligibility engine 100% of rule branches |
| API integration | Supertest + mongodb-memory-server | Every endpoint in doc 02, section 7.2 incl. permission denials | All permission-matrix rows (doc 05, section 8) have a test |
| E2E | Playwright (mobile viewport 360 × 640) | SOS, complaint (with and without AI), schemes browse + checker, authority resolve flow, login/refresh | All green on CI before each review |
| Accessibility | Lighthouse CI, axe DevTools, manual keyboard + TalkBack check | All main screens | Lighthouse a11y ≥ 90 |
| Performance | Lighthouse (Slow 4G, mobile) | Home, schemes, complaint wizard | LCP < 3 s, JS ≤ 250 KB gz |
| Device testing | Real phones: at least 1 low-end Android (2–3 GB RAM), 1 mid-range, 1 iPhone if available | Full citizen flows in Hindi at text size A+ | No blockers |
| AI evaluation | Test set + confusion matrix; Sahayak 50-question set | CNN + Sahayak | Targets in PRD section 8.2 |
| **User acceptance (field)** | Moderated tests with villagers (field visit 2 and pilot), SUS questionnaire in Hindi | 5 core tasks (doc 04, section 14) | SUS ≥ 68; task success ≥ 70% |
| SOS drills | Pre-announced drills with volunteers and the authority user | Full SOS chain | 10/10 successful |

**Deliverables:** test plan document, CI reports, accessibility and performance reports, field test results (anonymised), and a bug tracker with severity labels (P0 blocks release).

---

### Phase 7 — Deployment (first by S5-W6, then continuous) · Owner R1

| # | Task | When |
|---|---|---|
| 7.1 | Vercel project (production + previews), `vercel.json` rewrites + headers | S5-W6 |
| 7.2 | Render services for API and AI (Singapore), health checks, env vars | S5-W6 |
| 7.3 | Atlas prod project (Mumbai), DB users (app read/write, AI read-only), IP access list | S5-W6 |
| 7.4 | Run migrations + seeds on prod; create team admin accounts | S5-W6 |
| 7.5 | Custom domain (optional, e.g. a cheap `.in` domain) + HTTPS | S6 |
| 7.6 | Upgrade API instance to paid and DB to a backed-up tier for the pilot + demo weeks | S6-W9 |
| 7.7 | Backup restore drill | S6-W9 |
| 7.8 | Release tags: `v0.1` (Review-1), `v0.5` (Review-II), `v1.0` (pilot), `v1.1` (final) with changelogs | Each milestone |

**Deliverables:** public URL for each review; a deployment runbook in `docs/` (how to deploy, roll back, rotate keys, restore a backup).

---

### Phase 8 — Final polish (S6-W10 → W13, during the pilot) · Owners all, led by R2 + R4

| # | Task |
|---|---|
| 8.1 | Full Hindi copy review by a native speaker + changes from villager feedback |
| 8.2 | Accessibility fixes from the audit; text size A+ check on every screen |
| 8.3 | Performance fixes (bundle split, image sizes, font subsetting) |
| 8.4 | Empty/error state review against doc 03 for every screen |
| 8.5 | PWA offline checks (helplines, fake call, cached schemes, SOS SMS path) |
| 8.6 | Re-verify all schemes and emergency directory entries (dates updated) |
| 8.7 | Demo script (7 minutes) + backup demo video in case of network failure at the venue |
| 8.8 | Final report material: architecture diagrams, screenshots in both languages, test results, pilot metrics vs targets (PRD section 8), limitations and future work |

---

## 5. Review milestones — what to show

### ★ Progress Review-1 + Phase I report (~S5-W8, before FAT) — ≥ 40% of work

**Live demo (deployed URL, on a phone):**
1. Register in Hindi → add emergency contacts.
2. Press SOS → countdown → SMS app opens → authority dashboard pin appears → track link on a second phone → "I am safe".
3. Report a broken handpump with a photo → AI suggests "Water supply" → complaint number → timeline.
4. Browse schemes → open Laadli Behna or PM-KISAN detail with source and last-checked date.
5. Emergency numbers + nearest hospital from Mahodiya's location.

**Evidence for the Phase I report:** problem definition with field-visit 1 findings (photos, interview notes, consent), updated architecture and schema (docs 02 and 05), CNN v1 results, test results, a work-log summary (hours per member), and the Phase II plan (this document).

### ★ Progress Review-II (~S6-W6, week after CAT I)
Everything above **plus:** the complete complaint lifecycle from the authority side, eligibility checker (20 schemes), blood donor search + reveal, analytics v1, field visit 2 usability results, and CNN v1 → v2 plan.

### ★ Final Review-III + final reports (~S6-W13/14)
Everything **plus:** Sahayak (Q&A + letters), PWA offline, admin content tools, **pilot results in Mahodiya** (metrics vs PRD targets), SUS score, accessibility/performance reports, and CNN v2 results. Each member's **individual report** highlights their own role (section 3) with their PRs, designs, data or research as evidence.

---

## 6. Field work plan (Mahodiya, ~50 km — within the 100 km course limit)

| Visit | When | Goals | Output |
|---|---|---|---|
| **Field visit 1** | S5-W2 | Confirm the authority user (secretary/sarpanch/volunteer) and complaint routing. Verify the jurisdiction names. Collect handpump/road/streetlight photos (with consent). Interview 8–10 residents (women, farmers, youth) on schemes they know or miss. Check mobile network and phone types. | Visit report, consent forms, photo dataset, a list of priority schemes, and a confirmed authority contact |
| **Field visit 2** | S6-W4/W5 | Moderated usability test of the 5 core tasks with 8–10 villagers. Train the authority user on the portal. Collect SUS. | Usability report and a fix list |
| **Pilot** | S6-W10 → W13 | 4-week live use. Onboarding session at the Panchayat. A WhatsApp support group run by the team. Weekly check-in call with the authority user. Pre-announced SOS drills. | Pilot metrics (PRD section 8.1), testimonials (with consent), issues log |

**Ethics:** written or recorded verbal consent for interviews and photos. No photos of faces without consent. Explain clearly that this is a student project, not a government service. No incentives that could bias feedback.

---

## 7. Risks to the schedule

| Risk | Early warning | Response |
|---|---|---|
| CAT/FAT and other coursework squeeze time | Tasks slipping 2 weeks in a row | Cut P1 items first (fake call, map view, reopen). Never cut SOS, complaints or the i18n shell. |
| CNN accuracy below target | v1 test accuracy < 80% | More data for weak classes; merge confusing classes (e.g. waterlogging + water supply) into the category tiles; AI stays advisory. |
| No authority user agrees to the pilot | Not confirmed by the end of field visit 1 | A team member acts as authority and forwards complaints to the Panchayat; report this honestly. |
| Scheme data errors | Fails R4's verification | Only publish verified schemes. Fewer, correct schemes beat many unverified ones. |
| Free-tier limits hit during demos | Cold starts, quota errors | Paid tier for review/demo weeks (budget approved in advance); a backup demo video. |
| One member unavailable | Missed syncs | Every task has a reviewer who can take over; docs keep context. |

---

## 8. Using these documents with an AI coding agent

Give the agent docs **02, 03, 04 and 05** as context (and 01 for background), then work **one task ID at a time** from this plan.

**Standing rules to include in every agent session:**
1. Follow `shared/constants.json` for every enum. Don't invent new values or fields; if something is missing, stop and ask.
2. Screen behaviour comes from doc 03, visuals from doc 04, data from doc 05, APIs from doc 02. Quote the section you're implementing in the PR description.
3. Every user-visible string goes into both `hi` and `en` i18n files.
4. Write tests with each change. Don't mark a task done until tests pass locally.
5. Small PRs: one task ID per PR, branch `feat/<task-id>-<short-name>`.
6. Commits are authored under the team member's own git identity. Don't add AI co-author or session trailers to commit messages or PR descriptions.

**Example prompt for a task:**
> Implement task **4A.7** (S-30 public track page) from `docs/06_Implementation_Plan.md`. Behaviour: `docs/03_App_Flow.md` → S-30. API: `docs/02_Technical_Requirements.md` → `GET /track/:token`. Data: `docs/05_Backend_Schema.md` → 5.10 `sos_alerts` (only first name, lastLocation, status, lastUpdateAt may be exposed). Style: `docs/04_UI_UX_Design_Brief.md`. Include the expired-token, resolved and approximate-location states, Hindi + English strings, and a Playwright test.

---

## 9. Definition of done (whole project, v1.0)

- [ ] All P0 and P1 requirements in PRD section 5 are implemented, or explicitly deferred with a reason in the final report.
- [ ] Every screen in doc 03 exists, with loading/empty/error states.
- [ ] 100% of UI strings exist in Hindi and English, reviewed by a native speaker.
- [ ] Security requirements SEC-01…SEC-18 (doc 02, section 10) checked off.
- [ ] Tests: CI green, E2E for core flows, Lighthouse a11y ≥ 90.
- [ ] Deployed on a public URL with backups and monitoring.
- [ ] Pilot completed and metrics reported honestly against PRD targets.
- [ ] Docs 01–06 updated to match what was actually built (version 2.0 at the end).
