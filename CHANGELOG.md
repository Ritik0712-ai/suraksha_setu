# Changelog

What changed for each release of Suraksha Setu. Release tags follow the review milestones in
docs/06 §5 (`v0.1.0` Progress Review-1 · `v0.5.0` Review-II · `v1.0.0` pilot · `v1.1.0` final).
How to tag a release: docs/runbook.md §2.12.

## [Unreleased]

Everything so far — not yet tagged or deployed.

### Added

- **Phase 0–2 — foundation:** npm-workspaces monorepo (web, api, ai), `shared/constants.json`
  for every enum, CI, phone + password auth with rotating refresh tokens, roles and jurisdiction
  scoping, all 19 collections, seeds, complaint numbers, nightly encrypted backups.
- **Phase 3 — core UI:** government-style MUI theme, Hindi-first i18n, citizen and portal
  shells, auth/profile/contacts screens, system screens, PWA shell.
- **4A SOS:** countdown, SMS/email/real-time alerts, live tracking page, "I am safe",
  auto-close, fake call, offline path.
- **4B complaints:** CNN training pipeline, `/internal/classify` on LiteRT, photo + AI
  suggestion with manual fallback, routing, timeline, reopen.
- **4C–4F:** scheme catalogue (drafts until verified), eligibility checker, saved schemes;
  emergency helplines + curated directory with Places fallback; authority portal (complaints,
  live SOS, analytics, users, schemes editor, directory, departments, areas, audit log); blood
  donor search with masked phones and a reveal limit.
- **4G Sahayak:** LLM adapter (Gemini default), grounding on published schemes, emergency
  pre-check, chat API with limits, letter drafting with print/WhatsApp, 50-question evaluation set.
- **Phase 5 — integrations:** SMTP fallback, Places daily budget, Cloudinary folders per
  environment, uptime endpoints, LLM cost in analytics.
- **Phase 6 — testing:** Playwright E2E with accessibility scans, permissions-matrix tests,
  coverage gate, `pip-audit`.
- **Phase 7 — deployment config:** Render Blueprint (`render.yaml`), Vercel headers with a
  Content-Security-Policy checked by the E2E run, deployment runbook.
- **Phase 8 — polish:** E2E checks for text size A+ at 360 px and offline use; Hindi review
  sheet export; report screenshots; demo script and report-material guide.

### Changed

- Sahayak no longer fails when the free AI service is asleep: opening Sahayak wakes it, and a
  message waits for it (up to about a minute, with a "waking up" note) instead of showing
  "Couldn't get a reply". The API keeps itself awake in the daytime (GitHub's scheduled pings ran
  only a few times a day), and `/api/v1/health` checks the AI service only with `?ai=1`.

- Email now goes through a free Gmail relay (Google Apps Script) over HTTPS first, then Brevo,
  then SMTP. Render's free plan blocks SMTP ports, and Brevo requires a domain we don't own.

- Maps are now free OpenStreetMap maps (Leaflet, no key) everywhere Google Maps was planned — SOS,
  tracking link, complaint pin, emergency map view, portal live SOS, admin pin pickers. The CSP no
  longer allows inline or eval scripts.
- The citizen app's first download is ~13 KB smaller (socket.io loads after login), and the
  Schemes list is requested alongside the page's code (Schemes LCP 4.18 s → 3.77 s, slow 4G).

### Added (Oct 2026 — easier for villagers)

- **🔊 Listen** on schemes, Sahayak replies, letters, complaint status and the tour: read aloud
  in Hindi with the browser's own voice (free); stops with a second tap.
- **🎤 Speak to type** on Sahayak and the complaint description (browser speech recognition;
  `Permissions-Policy` now allows the microphone for our own pages).
- **"New version available — Update" bar:** the service worker now waits for one tap instead of
  phones running an old build until every tab closes; it also checks for updates every 30 min.
- **WhatsApp share** on schemes and complaint status (letters already had it).
- **3-picture tour** after the first language choice (SOS, complaints, Sahayak), read aloud;
  reopen from "How to use the app" on the home screen.
- **"Was this helpful? 👍👎"** on Sahayak replies and scheme pages — new `feedback` collection
  (one vote per person per item, no free text); totals for admins in Analytics.
- **Complaints saved offline:** with no internet the photo and complaint are kept on the phone
  (IndexedDB) and sent automatically when it's back; "Waiting to send" on My complaints.
- **"Me too"** on nearby complaints: before filing, open complaints of the same kind within
  500 m are shown (no description, photo or filer details) and a citizen can join one instead
  of filing a duplicate; officials see 👥 +n in the portal.
- **"Who is using the phone?"** on the login screen: names (and numbers) of people who logged in
  on this phone, citizens only, max 5, removable; never a password or token.
- **Scheme document reminders** on the home screen: saved schemes with documents still missing,
  with the list of what to collect; "Later" snoozes for a week.

### Fixed

- **Phones stuck on the old version (4 Oct):** the "Update" bar build made new versions wait for
  a tap, but the version already on phones had no such button, so they never updated (no 🔊/🎤,
  old Sahayak). New versions now take over at once (`skipWaiting` + `clientsClaim`); the page
  reloads by itself if it was opened in the last 15 s, otherwise the bar offers a reload. A
  missing screen file from an older deploy reloads the page once instead of crashing.
- **Sahayak no longer depends on the browser to wake the AI service:** the API wakes it through
  the web app's Vercel rewrite (`PUBLIC_APP_URL/ai-wake`, or `AI_WAKE_URL`), which Render treats
  as outside traffic; `/api/v1/health?ai=1` wakes it the same way.
- **Sahayak failing with "Couldn't get a reply" (1 Oct):** Render doesn't wake a sleeping free
  service for requests from another Render service, so the API's wake-up calls never woke the AI
  service. The browser now wakes it through a Vercel rewrite (`/ai-wake`) when Sahayak or the
  complaint form opens and on every Sahayak message; the API waits up to 70 s for it.

- Sahayak could show the emergency card twice for a moment.
- Lists on S-24, S-27 and the portal sidebar broke the WCAG "list" rule.
- Letters could repeat the salutation.
- `djangorestframework` 3.16 → 3.17.2 (PYSEC-2026-3827, PYSEC-2026-3828).
- API-only installs (Render) failed on the git-hook setup script.
