# Suraksha Setu — Test plan (Phase 6)

| | |
|---|---|
| **Owner** | R5 (Portal & QA), with R1 |
| **Covers** | docs/06 Phase 6 — unit, API integration, E2E, accessibility, performance, device, AI evaluation, field acceptance, SOS drills |
| **Rule** | CI must be green before every review demo. A **P0** bug (SOS, login, complaint submit, data leak) blocks a release. |

---

## 1. What runs automatically (CI, every push to `main`)

| Level | Tool | Where | Scope | Target |
|---|---|---|---|---|
| Unit — web | Vitest + React Testing Library + MSW | `apps/web/src/test/` | Every screen's states (loading, empty, error, 403/404), guards, i18n, stores, helpers | All green |
| Unit + integration — API | Vitest + Supertest + mongodb-memory-server | `apps/api/test/` | Every endpoint in docs/02 §7.2 incl. permission denials, eligibility engine, routing, transitions, compatibility, jurisdiction resolver, limits | All green; coverage gate in CI (`npm run test:coverage -w apps/api`): lines ≥ 85%, branches ≥ 75% (doc 06 asks ≥ 60%; measured 96% lines on 27 Sep 2026) |
| Permissions matrix | Supertest | `apps/api/test/integration/permissions.test.js` | Every row of docs/05 §8 (who may call what) | Every row has a test |
| Unit — AI | pytest | `apps/ai/core/tests/` | Classifier contract, SSRF guard, internal key, Sahayak prompt/grounding/parsing, providers, evaluation-set shape | All green |
| End-to-end | Playwright (Chromium, 360 × 640, Hindi) | `e2e/` | SOS, complaint with and without AI, authority resolve, schemes + checker, login/refresh, Sahayak Q&A + letter + emergency; text size A+ with no sideways scroll; offline shell/helplines/fake call; every page under the production CSP | All green |
| Accessibility | axe-core inside the E2E run | `e2e/tests/*.spec.js` | Home, login, emergency, schemes, S-06, S-10 review, S-15, S-17, S-24, S-26, fake call, portal overview/complaints/SOS/analytics | 0 serious or critical WCAG 2.1 A/AA issues |
| Localisation | `npm run i18n:check` | CI | Every key exists in `hi` and `en` | 100% |
| Dependencies | `npm audit` (high+), `pip-audit`, Dependabot alerts (no PRs) | CI + GitHub | Production dependencies of web/api and the AI service | 0 high/critical; 0 known (pip) |

## 2. Measured (record the numbers in the Phase II report)

Run before each review and paste the results here.

| Check | How | Target | Latest result |
|---|---|---|---|
| Lighthouse — Home (mobile, simulated slow 4G) | `CHROME_PATH=… npx lighthouse http://localhost:4173/` on `vite preview`, with `ss_lang` already saved (otherwise it measures S-01) — median of 5 runs | LCP < 3 s, a11y ≥ 90 | 27 Sep 2026 (after Phase 8): LCP 2.75 s (was 2.89 s), accessibility 100 |
| Lighthouse — Schemes list | same, `/schemes` | LCP < 3 s, a11y ≥ 90 | 27 Sep 2026 (after Phase 8): LCP 3.77 s ⚠ (was 4.18 s), blocking time 281 ms (was 604 ms), accessibility 100. First visit only — later visits load from the service-worker cache |
| Lighthouse — Login | same, `/login` | a11y ≥ 90 | 27 Sep 2026: LCP 3.5 s, accessibility 100 |
| Citizen first download | `npm run build -w apps/web` → size of the `index-*.js` that `index.html` loads (gzip) | ≤ 250 KB | 222.8 KB (socket.io now loads after login) |
| SOS → authority list | E2E `sos.spec.js` annotation `sos-to-portal-ms` (local) and a real phone on 4G | < 5 s (p95) | Local: < 1 s. Real 4G: _field visit 2_ |
| SOS → SMS app open | Stopwatch on a real phone | < 3 s | _field visit 2_ |
| CNN accuracy / inference | `ml/` evaluation on Colab | ≥ 87% top-1, < 300 ms | _CNN v1 report_ |
| Sahayak | `apps/ai/scripts/run_sahayak_eval.py` + human review | ≥ 90% acceptable, 100% emergency detection | Emergency pre-check: 5/5 in CI; LLM run: _needs the API key_ |
| Sahayak latency | A-06 analytics "average reply time" | < 6 s (p90) | _after the key is set_ |

## 3. Manual testing

### 3.1 Devices (before Review-II and before the pilot)

| Device | Browser | Language / text size | Flows |
|---|---|---|---|
| Low-end Android (2–3 GB RAM, e.g. a ₹7–8k phone) | Chrome | Hindi, **A+** | All citizen flows, install as app, offline helplines, fake call, SOS SMS |
| Mid-range Android | Chrome + Samsung Internet | Hindi and English | All citizen flows, portal on the phone |
| iPhone (if a team member has one) | Safari | English | Login, SOS (SMS sheet), complaint photo, letter print |
| Laptop | Chrome, Firefox | Both | Portal: complaints, live SOS map, analytics, scheme editor |

For every device: no horizontal scroll at 360 px, every primary button reachable with the thumb, Hindi text never clipped, TalkBack reads the SOS button and chat replies.

### 3.2 Keyboard and screen reader (portal + citizen)

- Tab through S-03, S-10, S-25 and A-03: visible focus everywhere, logical order, dialogs trap focus and return it.
- TalkBack (Android) on S-06, S-07, S-25: countdown announced, checklist changes announced, chat replies announced.

### 3.3 SOS drills (docs/01 §8.1: 10 of 10)

Pre-announce every drill to the contacts and the authority user. For each drill record: date/time, phone, network (2G/3G/4G/Wi-Fi), seconds to SMS app, seconds to portal pin, email received (Y/N), track link opened by the contact (Y/N), "I am safe" received (Y/N), issues.

| # | Scenario |
|---|---|
| 1–3 | Normal: GPS on, 4G, countdown to 0 |
| 4 | "Send now" |
| 5 | Location permission denied (village fallback) |
| 6 | Airplane mode → SMS with the map link opens, then back online → server SOS created |
| 7 | No contacts saved (112 + authority only) |
| 8 | Authority acknowledges, citizen sees "Acknowledged by …" |
| 9 | Authority closes, citizen answers "still need help" |
| 10 | Phone screen locked during the SOS (location updates resume on unlock) |

### 3.4 Field acceptance — usability test (field visit 2 and the pilot)

5 tasks (docs/04 §14), 8–10 villagers, moderated, in Hindi, one at a time. Don't help unless the person is stuck for 2 minutes (then it counts as "needed help").

1. एक टेस्ट SOS भेजें (पहले से बताई गई ड्रिल)। — *Send a test SOS.*
2. टूटे हैंडपंप की शिकायत फ़ोटो के साथ करें। — *Report a broken handpump with a photo.*
3. पता करें कि आपको कौन-सी योजनाएँ मिल सकती हैं। — *Find which schemes you can get.*
4. सबसे पास के अस्पताल का नंबर ढूँढें। — *Find the nearest hospital's number.*
5. सहायक से पंचायत को पत्र लिखवाएँ। — *Get Sahayak to write a letter to the Panchayat.*

Record per task: success without help / with help / failed, time taken, where they hesitated, quotes. Target: ≥ 70% succeed at task 3 without help.

**SUS questionnaire (Hindi)** — read aloud, answers on a 1–5 scale (1 = बिल्कुल असहमत, 5 = पूरी तरह सहमत). Draft translation — to be reviewed by the team's native Hindi speaker before use.

1. मुझे लगता है कि मैं यह ऐप बार-बार इस्तेमाल करना चाहूँगा/चाहूँगी।
2. यह ऐप ज़रूरत से ज़्यादा उलझा हुआ लगा।
3. यह ऐप इस्तेमाल करना आसान था।
4. इसे चलाने के लिए मुझे किसी जानकार की मदद चाहिए होगी।
5. ऐप के अलग-अलग हिस्से अच्छे से जुड़े हुए लगे।
6. ऐप में बहुत सी चीज़ें एक-दूसरे से मेल नहीं खातीं।
7. ज़्यादातर लोग इसे जल्दी सीख लेंगे।
8. इसे इस्तेमाल करना बहुत झंझट वाला लगा।
9. ऐप इस्तेमाल करते समय मुझे भरोसा था कि मैं सही कर रहा/रही हूँ।
10. इसे इस्तेमाल करने से पहले मुझे बहुत कुछ सीखना पड़ा।

Score: odd items (answer − 1), even items (5 − answer), sum × 2.5 → 0–100. Target ≥ 68.

**Ethics:** written or recorded verbal consent; no faces in photos without consent; say clearly that this is a student project, not a government service; no incentives that could bias answers (docs/06 §6).

## 4. Bugs

GitHub Issues with labels `P0` (blocks release: SOS, login, complaint submit, data leak, wrong scheme facts), `P1` (a flow is broken but has a workaround), `P2` (cosmetic), plus `hindi-copy`, `a11y`, `field-feedback`. Every P0 gets a regression test before it is closed.
