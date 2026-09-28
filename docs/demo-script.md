# Suraksha Setu — Demo script (doc 06 task 8.7)

A 7-minute live demo for the reviews, on the **deployed** app, in **Hindi**, on a real phone mirrored
to the projector, with a laptop showing the authority portal. Rehearse it twice with a stopwatch.
If anything fails, say so plainly and switch to the backup video — don't debug in front of the panel.

## Before the review (the day before)

- [ ] Production deploy passed the smoke test (docs/runbook.md §2.6); CI is green on the demo commit; tag it (§2.12).
- [ ] Wake the free Render services 10 minutes before: open `/api/v1/health?ai=1` until it shows `db: up, ai: up` (free instances sleep; the first request can take a minute), then open Sahayak once.
- [ ] Phone: logged in as the demo citizen ("Sunita"), text size **A**, language **हिन्दी**, 2 emergency contacts (team members who know a drill is coming), mobile data on, battery > 60%, Do Not Disturb on (except SMS).
- [ ] Laptop: logged in to the portal as the Mahodiya authority, Live SOS page open, sound allowed (click once on the page).
- [ ] A second phone (a teammate's) to open the tracking link.
- [ ] A printed photo of a broken handpump (for the complaint) in case the venue has no real one.
- [ ] Backup: the screen recording of this exact script (both screens) on the laptop and a pen drive.

## The 7 minutes

| Time | Show | Say (short) |
|---|---|---|
| 0:00–0:45 | Home in Hindi; emergency bar; A−/A/A+; EN ⇄ हि | "One app for Mahodiya: safety, complaints, schemes — in simple Hindi, big buttons, works on a ₹7,000 phone. Not a government service — our student project." |
| 0:45–2:30 | **SOS:** press SOS → 5-second countdown → sent → SMS app opens pre-filled → press Send. Laptop: red banner + sound + pin within 5 s → **Acknowledge**. Second phone: open the tracking link. Phone: **I am safe**. | "Cancel is instant during the countdown. The SMS goes from her own phone — free, works even if our server is down. The officer sees it live; her family sees the live location without an app." |
| 2:30–4:00 | **Complaint:** Report a problem → photograph the handpump → "AI thinks: Water supply" → confirm → location pin → review shows the department → submit → complaint number. Laptop: it's in the table → Verify → Assign. Phone: the timeline updates. | "The AI only suggests; the villager always decides. Every complaint gets a number, a department and a visible history." |
| 4:00–5:15 | **Schemes:** search "किसान" → PM-KISAN detail: source + last checked + disclaimer → **Check eligibility** (8 questions, tap-tap) → grouped results. | "Only verified schemes are published. We never guess amounts — the office decides." |
| 5:15–6:15 | **Sahayak:** "पंचायत को पत्र लिखें" → answer 3 questions → the formatted Hindi letter → Print / WhatsApp. Then type "bachao" → SOS card appears instantly. | "Answers come only from our scheme data. Emergency words skip the AI entirely." |
| 6:15–7:00 | **Emergency numbers** in airplane mode (still there); portal Analytics for 5 seconds; close. | "What we measured, and what the pilot will measure" — one line of results from the report. |

For **Review-1** (Phase I, ~40%) stop after Schemes and show Emergency; for **Review-II** add the blood-donor search and analytics; for the **final review** add pilot results (PRD §8.1) at the end.

## Questions to be ready for (viva)

- Why a web app and not Android? → docs/02 ADR-01. Why a separate AI service? → docs/02 §2.3.
- What if the server is down during an SOS? → SMS path on the phone + retries (docs/02 §8.1).
- What if the AI is wrong? → confidence threshold 0.60, the citizen confirms, the authority can re-categorise, corrections feed CNN v2.
- How do you stop Sahayak inventing scheme facts? → grounding on published schemes only, no tools, scheme cards limited to our slugs, disclaimer, 50-question evaluation.
- Privacy? → masked donor phones, first name only on the tracking page, consent, retention limits (docs/05 §10), DPDP alignment (docs/02 SEC-13).
- Security? → docs/02 §10: rotating refresh tokens, rate limits, CSP, audit log, permissions matrix tested on every push.
