# End-to-end tests (docs/06 Phase 6)

Playwright drives the **real** web build, API, database and AI service on a 360 × 640 phone
viewport in Hindi — the way a villager uses the app.

| Spec                | What it proves                                                                                                                                                                                              |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth.spec.js`      | Login errors, staying logged in after a reload (refresh cookie), logout, authority → portal, and an accessibility scan (axe, WCAG 2.1 A/AA: no serious or critical issues) of the public and portal screens |
| `sos.spec.js`       | SOS countdown → sent → the SMS link is pre-filled for the contact with the tracking link → the officer's live list shows it within 5 s → acknowledge → "I am safe"; cancel sends nothing; fake call         |
| `complaint.spec.js` | Photo → AI suggests "road damage" → submit → the officer verifies, assigns, starts and resolves → the citizen sees the public note; also a complaint without a photo                                        |
| `schemes.spec.js`   | Search → scheme detail with source, last-checked date and disclaimer; the eligibility checker to grouped results                                                                                            |
| `sahayak.spec.js`   | A scheme question gets grounded scheme cards; the Panchayat letter flow ends in a printable letter; "bachao" shows the SOS card                                                                             |

## How it runs

`e2e/stack.js` starts an in-memory MongoDB, seeds the pilot data (jurisdictions, departments,
the 20 schemes — published for the tests), three accounts (`e2e/accounts.js`), then the API on
:5055 and the AI service on :8055 with the 2 KB test model and the offline `fake` LLM. The web
app is built and served by `vite preview` on :4173 with `/api` proxied to the API.

```bash
# once: Python deps for the AI service (see the main README) and a browser
npx playwright install chromium

npm run e2e                       # everything (starts and stops the servers)
npm run e2e -- tests/sos.spec.js  # one file
```

- Locally, servers that are already running are reused (handy while writing tests); restart
  `node e2e/stack.js` for a clean database.
- If `python3` can't run the AI service, the stack still starts and the app's AI fallbacks run
  (the AI-dependent assertions then fail). Point `E2E_PYTHON` at a Python 3.11 with
  `apps/ai/requirements.txt` installed.
- To use an already-installed Chromium: `E2E_CHROMIUM=/path/to/chrome npm run e2e`.
- `sms:` links can't open an SMS app in a desktop browser, so the SOS test sets
  `window.__ssExternalLinks` and the app records the link instead of navigating
  (`apps/web/src/lib/device.js`).
- CI runs this suite in the `e2e` job; the HTML report is uploaded as an artifact when it fails.
