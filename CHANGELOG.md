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

- The citizen app's first download is ~13 KB smaller (socket.io loads after login), and the
  Schemes list is requested alongside the page's code (Schemes LCP 4.18 s → 3.77 s, slow 4G).

### Fixed

- Sahayak could show the emergency card twice for a moment.
- Lists on S-24, S-27 and the portal sidebar broke the WCAG "list" rule.
- Letters could repeat the salutation.
- `djangorestframework` 3.16 → 3.17.2 (PYSEC-2026-3827, PYSEC-2026-3828).
- API-only installs (Render) failed on the git-hook setup script.
