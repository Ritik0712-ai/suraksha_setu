# Suraksha Setu — Report material (doc 06 task 8.8)

Where each piece of evidence for the Phase I, Phase II and final reports comes from, and how to
regenerate it. Numbers go in the report with the date they were measured; targets are from
docs/01 §8. Report misses honestly (docs/06 §4 Phase 8).

## 1. Diagrams

| Diagram | Source |
|---|---|
| System architecture | docs/02 §2.1 (Mermaid) and the deploy picture in docs/runbook.md §2 |
| SOS and complaint sequences | docs/02 §8.1, §8.2 |
| ER diagram | docs/05 §2 |
| Screen map | docs/03 §3 |

Render Mermaid to PNG at <https://mermaid.live> (paste the block → Actions → PNG).

## 2. Screenshots (both languages)

```bash
npm run screenshots        # → e2e/screenshots-out/<hi|en>/<phone|desktop>/<screen>.png
```

Covers S-02, S-03, S-06, S-09, S-10, S-12, S-14, S-16, S-20, S-21, S-24, S-27, S-28, S-31 and
A-01, A-02, A-04, A-06, A-08. It runs on the E2E test database, so lists are mostly empty; for the
final report, also take phone screenshots of real screens during the pilot (no faces, no real
phone numbers).

## 3. Test and quality results

| What | How | Latest (27 Sep 2026) | Target |
|---|---|---|---|
| Automated tests | CI on `main` | API 357 · web 141 · AI 60 · E2E 17 — all passing | all green |
| API line coverage | `npm run test:coverage -w apps/api` | 96% lines, 83.5% branches | ≥ 60% (doc 06) |
| Accessibility (automated) | axe in every E2E run; Lighthouse | 0 serious/critical; Lighthouse a11y 100 on Home, Schemes, Login | ≥ 90 |
| Text size A+ at 360 px | `e2e/tests/polish.spec.js` | no sideways scroll on 17 main screens | none |
| Offline | `e2e/tests/polish.spec.js` | shell, helplines and fake call work offline | works |
| Citizen first download | build → gzip of `index-*.js` | ≈ 223 KB | ≤ 250 KB |
| LCP, slow 4G (first visit) | Lighthouse, median of 5 | Home 2.75 s · Schemes 3.77 s ⚠ | < 3 s |
| Dependencies | `npm audit`, `pip-audit` in CI | 0 high/critical, 0 known | 0 |
| Security | docs/02 §10 SEC-01…18 | checklist in the final report | all |

Details and the manual plans (devices, screen reader, SOS drills, usability): docs/test-plan.md.

## 4. Field and AI results (fill in)

| What | Where it comes from | Target (docs/01 §8) |
|---|---|---|
| Field visit notes, consent forms, photos | R4's visit reports | — |
| SUS score, task success | field visit 2 + pilot (docs/test-plan.md §3.4) | SUS ≥ 68, ≥ 70% |
| SOS → portal, SOS → SMS | drills on real phones | < 5 s, < 3 s |
| CNN v1/v2 accuracy, per-class F1, confusion matrix | `ml/` evaluation on Colab | ≥ 87%, < 300 ms |
| Sahayak evaluation | `apps/ai/scripts/run_sahayak_eval.py` + team review | ≥ 90% acceptable, 100% emergency |
| Sahayak cost per 100 messages, latency | Portal → Analytics (admin) | < 6 s p90 |
| Pilot usage (users, complaints, resolved %, checker, letters) | Portal → Analytics + CSV export | docs/01 §8.1 |

## 5. Individual contributions (DSN3099 individual reports)

- Commits per member: `git shortlog -sn --all` and `git log --author="<name>" --stat`.
- Each member's area is in docs/06 §3 (R1–R5). Attach the PRs/commits, designs, datasets or
  research that are theirs, plus their log-book hours.

## 6. Limitations and future work (starting list)

- **Not yet verified in the field:** jurisdiction names, departments/routing, the emergency directory and all 20 schemes are placeholders or drafts until R4 verifies them.
- **Hindi copy** needs a native-speaker review (`npm run i18n:sheet -w apps/web` exports every string, UI and API, to a CSV with a "reviewed Hindi" column) and testing with villagers.
- **Schemes page first visit** is ~3.8 s LCP on simulated slow 4G (target 3 s); repeat visits load from the service-worker cache.
- **Free hosting:** Render free instances sleep at night (≈1 min first request; SOS still works on the phone); OpenStreetMap maps instead of Google Maps (which needs billing); M0 has no snapshots (nightly dump instead).
- **Map tiles** come from OpenStreetMap's free public server, which is meant for light use — fine for the pilot; a larger rollout would need its own or another free tile host.
- **v1 by design (docs/01 §9):** no SMS OTP, no server-sent SMS, no background location, no native app, no voice SOS — each with the reason and the v2 path.
- **AI:** CNN accuracy on real village photos is unknown until field data; Sahayak runs on the Gemini free tier (rate limits; Google may use free-tier prompts to improve its products — disclosed to users) and needs the evaluation run before the pilot.
