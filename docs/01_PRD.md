# Suraksha Setu (सुरक्षा सेतु) — Product Requirements Document

| | |
|---|---|
| **Document** | 01 — Product Requirements Document (PRD) |
| **Version** | 1.0 (draft for team review) |
| **Date** | 26 September 2026 |
| **Owner** | Ritik Agarwal, on behalf of the Suraksha Setu team |
| **Course** | DSN3099 — Engineering Projects in Community Service, VIT Bhopal |
| **Related docs** | 02 Technical Requirements · 03 App Flow · 04 UI/UX Brief · 05 Backend Schema · 06 Implementation Plan |

> **Status of this project.** Suraksha Setu is an independent student project. It is **not** a government service and is not affiliated with any government body. It uses publicly available government information (for example, scheme details from official portals) and shows the source for that information.

---

## 1. App overview

### 1.1 One-line summary
Suraksha Setu ("safety bridge") is a bilingual (Hindi + English), mobile-first web app that puts emergency help, civic complaints, government-scheme guidance, blood-donor search and a Hindi writing assistant in one place for rural communities. The pilot village is **Mahodiya, Sehore district, Madhya Pradesh**.

### 1.2 What it is and isn't
- **It is** a responsive web app that works well on a low-cost Android phone in the Chrome browser, over a weak 3G/4G connection. It can be installed to the home screen (PWA).
- **It is** one account with seven modules that share the same login, profile, language setting and design.
- **It isn't** a native Android/iOS app in version 1. That comes later.
- **It isn't** a replacement for 112, 108 or other official helplines. It points people to them faster and adds the things those helplines don't do.

### 1.3 The seven modules

| # | Module | Hindi name | What it does | Priority |
|---|---|---|---|---|
| M1 | Women's SOS | महिला सुरक्षा | One-tap SOS that captures GPS, alerts saved emergency contacts, and shows the alert live to the authority dashboard. Includes a fake-call screen. | P0 |
| M2 | AI Civic Complaints | नागरिक शिकायत | Citizen photographs a problem (broken road, handpump, streetlight, garbage, waterlogging). A CNN model suggests the category. The complaint is routed and tracked until resolved. | P0 |
| M3 | Government Schemes | सरकारी योजनाएं | Browse schemes in simple Hindi, check likely eligibility with a short questionnaire, see which documents to carry and how to apply, with a link to the official source. | P0 |
| M4 | Blood Donor Directory | रक्तदान | Register as a voluntary donor. Search nearby eligible donors by blood group and contact them. | P1 |
| M5 | Nearby Emergency Services | आपातकाल सेवाएं | National helplines plus nearest hospital, police station, ambulance and fire service, with distance, one-tap call and directions. | P0 |
| M6 | Authority Dashboard | प्रशासन पोर्टल | Separate portal for officers and Panchayat staff: manage complaints, watch live SOS alerts, see analytics. | P0 |
| M7 | Sahayak AI Chatbot | सहायक | Hindi-first assistant that explains schemes, guides users step by step, and drafts letters/applications to the Gram Panchayat, BDO or other offices. | P1 |

Priority key: **P0** = must be in the MVP · **P1** = in the MVP but can ship in a simpler form · **P2** = after the MVP.

---

## 2. Problem statement

### 2.1 Context: Mahodiya village
Mahodiya is about 50 km from Bhopal and 9 km from Sehore town. It has about 1,919 people in 375 households and 24.4% of the population is Scheduled Caste. Female literacy is roughly 52–62%. The village has:
- no hospital or Primary Health Centre,
- no secondary school,
- no bus service,
- no tap water (only handpumps and borewells).

Roads get worse after every monsoon. Mobile data exists, but many people share phones and have little experience with digital services. (The village is also well known as the filming location of the web series *Panchayat*.)

### 2.2 The problems

| Area | What happens today | Why it hurts |
|---|---|---|
| **Emergencies & women's safety** | There is no health facility in the village, and the nearest ones are in Sehore. People don't always know which number to call. A woman in danger has no quick way to tell family where she is. | Time is lost. Family and responders don't know the location. |
| **Civic problems** | Broken handpumps, damaged roads, dead streetlights and garbage are reported verbally to the sarpanch or secretary. There's no written record and no status. | Problems stay open for months. Nobody is accountable and there's no data. |
| **Government schemes** | Information on schemes such as Laadli Behna, PM-KISAN, Ayushman Bharat and PMAY-G is scattered, often in formal language, and the document requirements are unclear. People depend on middlemen. | Eligible families miss benefits or pay someone to apply for them. |
| **Blood** | Families look for donors by word of mouth during emergencies. | Delays in critical cases. |
| **Writing to offices** | Villagers who need to write an application (for example, to the Panchayat about a handpump or to the BDO about a scheme) often pay someone to write it. | Cost, dependency and delay. |

### 2.3 Problem statement
> Rural residents of villages like Mahodiya have no single, simple, Hindi-first way to get emergency help, report and track civic problems, understand which government schemes they are eligible for, find blood donors, or write formal applications. As a result, help arrives late, problems go unrecorded and unresolved, and eligible families miss benefits.

### 2.4 Our hypothesis
If we give villagers **one** app that works on the phone they already have, speaks their language, uses big icons instead of long text, and keeps a record of every request, then:
- emergencies will reach family and responders faster,
- civic complaints will be recorded, routed and resolved in a way that can be measured,
- more families will learn which schemes they qualify for and what to carry when they apply.

---

## 3. Goals and non-goals

### 3.1 Product goals (version 1)
1. **G1 — Faster help:** a user can send an SOS with location in 3 taps or fewer, and it takes under 10 seconds from pressing the button to contacts being alerted.
2. **G2 — Accountable complaints:** every complaint gets an ID, a category, a responsible department and a visible status history.
3. **G3 — Scheme awareness:** a user can find out which schemes they are likely eligible for in under 2 minutes, in Hindi.
4. **G4 — Usable by low-literacy users:** every primary action has an icon plus a short label, and the whole app works in Hindi.
5. **G5 — Demonstrable impact:** run a real field pilot in Mahodiya and collect usage and usability data for the DSN3099 reviews.

### 3.2 Non-goals (version 1)
- Replacing official helplines or government grievance portals.
- Processing actual scheme applications or payments.
- Guaranteeing eligibility. The app says "you are likely eligible, confirm at the office".
- Nationwide coverage. We launch with one village and its surrounding area (Sehore district).

---

## 4. Target users

### 4.1 User roles

| Role | Who | Access |
|---|---|---|
| **Citizen** (नागरिक) | Villagers of Mahodiya and nearby villages | Citizen app (M1–M5, M7) |
| **Authority** (अधिकारी) | Panchayat secretary, department staff, or a nominated officer/volunteer acting for a department | Authority Dashboard (M6) for their jurisdiction and department |
| **Admin** (प्रशासक) | The project team | Everything, plus content management (schemes, emergency directory, departments, authority accounts) |

### 4.2 Personas

**Sunita, 32 — homemaker, Mahodiya**
- Reads Hindi slowly and doesn't read English. Shares an Android phone with her husband. Uses WhatsApp and YouTube.
- *Needs:* to know whether she qualifies for Laadli Behna and Ayushman Bharat and which documents to take, and a way to call for help at night.
- *Frustrations:* government websites are in English or formal Hindi, she depends on others, and she's afraid of pressing the wrong thing.

**Ramesh, 45 — farmer**
- Gets PM-KISAN. The handpump near his house has been broken for three weeks.
- *Needs:* to report the handpump and see whether anyone is acting on it, and to write an application to the Panchayat.
- *Frustrations:* verbal complaints are forgotten, and he has to pay someone to write letters.

**Pooja, 19 — college student who commutes to Sehore**
- Confident smartphone user and bilingual.
- *Needs:* a quick SOS on the road, a fake call to get out of uncomfortable situations, and a blood donor for her uncle's surgery.
- *Frustrations:* there's no bus, and roads are empty in the evening.

**Mr. Verma, 50 — Panchayat secretary / authority user**
- Uses a laptop at the Panchayat office and a phone in the field.
- *Needs:* one list of all complaints in his area, the ability to assign them to the right department, and proof of what was resolved.
- *Frustrations:* complaints arrive verbally or on paper with no photo or location.

**Digital Saathi (volunteer helper)** — a literate young person in the village who helps others use the app. This isn't a separate role in v1. The complaint form has a "filing for someone else" option so the helper can file with the other person's name and phone.

---

## 5. Core features

Requirement IDs use the format `FR-<module>-<number>`. The App Flow document (03) describes each screen in detail.

### 5.1 Platform-wide (FR-GEN)

| ID | Requirement | Priority |
|---|---|---|
| FR-GEN-01 | The whole UI is available in **Hindi and English**. The user picks a language on first launch and can switch at any time from the header. Hindi is the default. | P0 |
| FR-GEN-02 | Register and log in with **mobile number + password**. Email is optional. | P0 |
| FR-GEN-03 | An **emergency bar** with a "Call 112" button is visible on every citizen screen, even when logged out. | P0 |
| FR-GEN-04 | Text-size control **A− / A / A+** in the header. The choice is remembered on the device. | P0 |
| FR-GEN-05 | Icon + label on every primary action. Status is never shown by color alone. | P0 |
| FR-GEN-06 | Installable as a PWA. The app shell, emergency numbers and last-viewed scheme details work offline. | P1 |
| FR-GEN-07 | In-app notifications for status changes (complaint updates, SOS acknowledged). | P1 |
| FR-GEN-08 | Consent screen at registration explaining what data is collected (location, phone, photos) and why. | P0 |
| FR-GEN-09 | Footer disclaimer on every page: independent student project, not a government service. | P0 |

### 5.2 M1 — Women's SOS (FR-SOS)

| ID | Requirement | Priority |
|---|---|---|
| FR-SOS-01 | Large SOS button on the home screen and in the bottom navigation. | P0 |
| FR-SOS-02 | Pressing SOS starts a **5-second countdown** with a large Cancel button and a "Send now" button to skip the countdown. This prevents accidental alerts. | P0 |
| FR-SOS-03 | On send: capture GPS (high accuracy) and create an SOS record with status ACTIVE. If GPS fails, send anyway with the last known location or the user's village and mark the location as approximate. | P0 |
| FR-SOS-04 | Alert all saved emergency contacts (up to 5). v1 channels: **(a)** a pre-filled SMS opened on the user's own phone (`sms:` link with all contacts and a live-location link), **(b)** email to contacts who have one, **(c)** a real-time alert on the Authority Dashboard for the user's jurisdiction. | P0 |
| FR-SOS-05 | While ACTIVE, the location updates every 30 seconds while the SOS screen is open. | P0 |
| FR-SOS-06 | Public live-location page (`/track/:token`) that contacts can open without logging in. It shows the name, last location on a map and last-updated time. The token expires when the SOS ends or after 24 hours. | P0 |
| FR-SOS-07 | An "I am safe" button resolves the SOS and notifies contacts and the authority. | P0 |
| FR-SOS-08 | A one-tap **Call 112** button on the SOS-active screen. | P0 |
| FR-SOS-09 | **Fake call:** a full-screen incoming-call simulation with a caller name the user chooses, a ringtone and vibration, and an optional delay (now, 10 s, 30 s). | P1 |
| FR-SOS-10 | Manage up to 5 emergency contacts (name, relation, mobile, optional email). At least one is needed before the first SOS; if none exist, SOS still works but only calls 112 and alerts the authority. | P0 |
| FR-SOS-11 | An SOS with no update for 6 hours is auto-closed and logged. | P1 |

### 5.3 M2 — AI Civic Complaints (FR-CMP)

| ID | Requirement | Priority |
|---|---|---|
| FR-CMP-01 | Citizen takes or uploads a photo, which is compressed on the phone before upload (target < 500 KB). | P0 |
| FR-CMP-02 | The AI classifies the photo into one of 7 categories: **Road damage/pothole, Garbage, Broken streetlight, Waterlogging, Water supply (handpump/pipe), Encroachment, Other**. It returns a category and a confidence score. | P0 |
| FR-CMP-03 | If confidence ≥ 0.60, the suggested category is pre-selected and the user confirms or changes it. If below 0.60, the user picks from icon tiles. The AI never blocks submission. | P0 |
| FR-CMP-04 | The location is captured automatically and can be adjusted by dragging a pin. The user can also enter a landmark ("near the school"). | P0 |
| FR-CMP-05 | Optional description (text, up to 500 characters). | P0 |
| FR-CMP-06 | The complaint gets a human-readable ID (for example, `SS-2026-000123`) and is auto-routed to a department based on category and jurisdiction. | P0 |
| FR-CMP-07 | Status lifecycle: **SUBMITTED → VERIFIED → ASSIGNED → IN_PROGRESS → RESOLVED**, plus **REJECTED** (with a reason). The citizen sees a timeline of every change. | P0 |
| FR-CMP-08 | The citizen can **reopen** a resolved complaint within 7 days if the problem is still there. | P1 |
| FR-CMP-09 | The authority can attach a "resolution photo" when resolving. | P1 |
| FR-CMP-10 | "Filing for someone else" option: name and phone of the affected person. | P1 |
| FR-CMP-11 | Duplicate hint: if an open complaint of the same category exists within 100 m, show it and offer "Add my support (+1)" instead of a new complaint. | P2 |

### 5.4 M3 — Government Schemes (FR-SCH)

| ID | Requirement | Priority |
|---|---|---|
| FR-SCH-01 | Scheme catalogue curated by the admin (starting with 15–25 central and MP schemes relevant to Mahodiya) with fields: name (hi/en), simple summary, benefits, eligibility, documents needed, how to apply, where to apply, official link, source, last-verified date. | P0 |
| FR-SCH-02 | Browse by category (Women, Farmers, Health, Housing, Education, Pension, Employment) with icon tiles, plus search in Hindi or English. | P0 |
| FR-SCH-03 | **Eligibility checker:** a questionnaire of up to 8 questions (age, gender, occupation, land ownership, annual family income band, social category, BPL/ration card status, disability). It returns "Likely eligible", "Maybe — check" or "Not eligible", with the reason for each scheme. | P0 |
| FR-SCH-04 | Every scheme page shows "**Source:** <official site> · **Last checked:** <date>" and the disclaimer "Final eligibility is decided by the government office." | P0 |
| FR-SCH-05 | Save schemes to "My Schemes" and see a document checklist the user can tick off. | P1 |
| FR-SCH-06 | "Ask Sahayak about this scheme" button that opens the chatbot with the scheme loaded as context. | P1 |
| FR-SCH-07 | "Read aloud" button (browser text-to-speech in Hindi) on scheme detail pages. | P2 |

### 5.5 M4 — Blood Donor Directory (FR-BLD)

| ID | Requirement | Priority |
|---|---|---|
| FR-BLD-01 | Any logged-in user can register as a donor: blood group, date of last donation, location (village + GPS), and an "Available to donate" toggle. | P0 |
| FR-BLD-02 | Search by blood group, including compatible groups (for example, O− can give to all), sorted by distance, within 5 / 10 / 25 / 50 km. | P0 |
| FR-BLD-03 | Only donors who are **eligible** (90+ days since last donation) and **available** appear in results. | P0 |
| FR-BLD-04 | Donor phone numbers are **masked** in results. Tapping "Call" logs the request and shows the number to the logged-in searcher only. Rate limit: 10 reveals per day per user. | P0 |
| FR-BLD-05 | Donors can switch availability off or delete their donor profile at any time. | P0 |

### 5.6 M5 — Nearby Emergency Services (FR-EMG)

| ID | Requirement | Priority |
|---|---|---|
| FR-EMG-01 | National helplines card, always available offline: 112 (all emergencies), 108 (ambulance), 1091 / 181 (women), 1098 (child), 1930 (cyber fraud), 101 (fire), 100 (police). | P0 |
| FR-EMG-02 | Nearby services by type (Hospital, Police, Ambulance, Fire, Pharmacy) using a **curated directory** for Sehore district first, with a Google Places search as backup when the directory has fewer than 3 results. | P0 |
| FR-EMG-03 | Each result shows name, type, distance, phone (one-tap call) and a "Directions" button that opens Google Maps. | P0 |
| FR-EMG-04 | Map view and list view toggle. The list is the default because it's lighter on data. | P1 |

### 5.7 M6 — Authority Dashboard (FR-ADM)

| ID | Requirement | Priority |
|---|---|---|
| FR-ADM-01 | Separate portal for Authority and Admin roles. Authority accounts are created only by an Admin. | P0 |
| FR-ADM-02 | Overview: KPI cards (open complaints, resolved this week, active SOS, average resolution days) and a recent-activity feed. | P0 |
| FR-ADM-03 | Complaints table: filter by status, category, department, date, and search by ID. Open a complaint to verify, assign a department or officer, change status, add a public note or internal note, attach a resolution photo, or reject with a reason. | P0 |
| FR-ADM-04 | **Live SOS map:** active SOS pins update in real time. Clicking a pin shows the user, contacts, location trail, and "Acknowledge" and "Resolve" actions. A new SOS plays a sound and shows a banner. | P0 |
| FR-ADM-05 | Analytics: complaints by category, status funnel, resolution time trend, SOS per day, scheme-checker usage. | P1 |
| FR-ADM-06 | CSV export of complaints for a date range. | P1 |
| FR-ADM-07 | Admin-only content management: schemes (CRUD + publish/unpublish), emergency-service directory, departments, jurisdictions, authority accounts. | P0 |
| FR-ADM-08 | Audit log of every admin/authority action. | P1 |

### 5.8 M7 — Sahayak AI Chatbot (FR-SHK)

| ID | Requirement | Priority |
|---|---|---|
| FR-SHK-01 | Chat interface in Hindi (default) or English. It replies in the user's language, in simple words. | P1 |
| FR-SHK-02 | Answers about schemes are **grounded in our scheme catalogue**. If a scheme isn't in the catalogue, Sahayak says so and points to the official portal instead of guessing. | P1 |
| FR-SHK-03 | **Letter drafting:** guided flow for common letters: (1) complaint to the Gram Panchayat, (2) application to the BDO/Janpad Panchayat, (3) application for a certificate (income/caste/residence), (4) general application. Sahayak asks for the missing details, then produces a formatted letter. | P1 |
| FR-SHK-04 | The letter can be copied, shared to WhatsApp, or printed/saved as PDF. | P1 |
| FR-SHK-05 | Quick-start chips: "Which schemes can I get?", "Write a letter to the Panchayat", "How do I file a complaint?", "Emergency numbers". | P1 |
| FR-SHK-06 | If the user's message suggests an emergency ("help", "बचाओ", "accident"), Sahayak immediately shows the SOS and Call 112 buttons before any other reply. | P0 (if M7 ships) |
| FR-SHK-07 | Daily message limit per user (for example, 30) to control API cost. | P1 |
| FR-SHK-08 | Voice input (speech-to-text in Hindi). | P2 |

---

## 6. User stories

Format: *As a [role], I want [goal], so that [benefit].* Each story lists acceptance criteria (AC).

### Onboarding and account
**US-01** — As a first-time visitor, I want to choose Hindi or English before anything else, so that I understand the app from the first screen.
- AC1: The language screen shows two large buttons: "हिन्दी" and "English".
- AC2: The choice is saved on the device and in the profile after registration.

**US-02** — As a villager, I want to register with just my mobile number, name, village and a password, so that I don't need an email.
- AC1: Registration has 4 required fields plus the consent checkbox.
- AC2: A duplicate mobile number shows "This number is already registered — Log in?"

**US-03** — As a user who forgot my password, I want a way to reset it, so that I'm not locked out.
- AC1: If I have an email, I get a reset link.
- AC2: If I don't, I see instructions to get a one-time reset code from an admin/volunteer.

### M1 SOS
**US-04** — As a woman in danger, I want to send my location to my family with one press, so that they can reach me or send help.
- AC1: SOS → countdown (5 s) → alert sent; or SOS → "Send now" → sent immediately.
- AC2: The SMS app opens pre-filled with all contacts and a live-location link.
- AC3: The authority dashboard shows the pin within 5 seconds.

**US-05** — As an SOS sender, I want to cancel an accidental SOS, so that I don't scare my family.
- AC1: Cancel during the countdown sends nothing.
- AC2: "I am safe" within 60 s of sending marks it as FALSE_ALARM and sends an "all OK" message.

**US-06** — As an emergency contact, I want to open a link and see where she is, so that I can go to her.
- AC1: The link works without an account.
- AC2: It shows the last location, time since update, and a "Call her" button.

**US-07** — As a user in an uncomfortable situation, I want a fake incoming call, so that I have an excuse to leave.
- AC1: The fake call looks like a real incoming call screen, with ringtone and vibration.

**US-08** — As a user, I want to save up to 5 emergency contacts, so that the right people are alerted.

### M2 Complaints
**US-09** — As a villager, I want to take a photo of the broken handpump and submit it, so that the right department knows about it.
- AC1: The AI suggests "Water supply" with its confidence shown as a simple label (for example, "AI is fairly sure").
- AC2: I can change the category with one tap.
- AC3: I get a complaint ID on the success screen.

**US-10** — As a complainant, I want to see the status of my complaint, so that I know whether anyone is acting on it.
- AC1: "My complaints" shows each complaint with a status chip (text + icon).
- AC2: The detail page shows a dated timeline and public notes from the authority.

**US-11** — As a complainant, I want to reopen a complaint marked resolved when it isn't, so that it isn't closed falsely.

**US-12** — As a Digital Saathi, I want to file a complaint on behalf of an elderly neighbour, so that she's included even without a phone.

### M3 Schemes
**US-13** — As Sunita, I want to answer a few simple questions and see which schemes I can get, so that I don't miss benefits.
- AC1: No more than 8 questions, each with icon options.
- AC2: Results are grouped: Likely eligible / Maybe / Not eligible, with a one-line reason.

**US-14** — As a user, I want to see exactly which documents to carry and where to go, so that I don't make wasted trips to the office.

**US-15** — As a user, I want to see where the information comes from and when it was checked, so that I can trust it.

**US-16** — As a user, I want to save a scheme and tick off documents as I collect them.

### M4 Blood
**US-17** — As a family member of a patient, I want to find O+ donors within 25 km, so that I can arrange blood quickly.
- AC1: Results show only eligible, available donors sorted by distance, with compatible groups included and labelled.

**US-18** — As a donor, I want to turn my availability off when I'm travelling or unwell, so that people don't call me unnecessarily.

**US-19** — As a donor, I want my phone number hidden from the public list, so that I'm not spammed.

### M5 Emergency
**US-20** — As anyone (even logged out), I want to see emergency numbers and call them in one tap.

**US-21** — As a user, I want to find the nearest hospital with its phone number and directions.

### M6 Authority
**US-22** — As a Panchayat secretary, I want to see all open complaints in my village in one table, so that I can prioritise.

**US-23** — As an officer, I want to assign a complaint to the right department and update its status, so that the citizen sees progress.

**US-24** — As an officer on duty, I want to be alerted immediately when an SOS is raised in my area, so that I can respond.
- AC1: Banner + sound + pin within 5 s. "Acknowledge" records my name and time.

**US-25** — As an admin, I want to add or edit schemes and mark when I last verified them, so that the information stays accurate.

**US-26** — As an admin, I want to create authority accounts tied to a jurisdiction and department, so that officers only see their area.

### M7 Sahayak
**US-27** — As Ramesh, I want Sahayak to write my handpump application to the Panchayat in proper Hindi, so that I don't have to pay someone.
- AC1: Sahayak asks for name, village, problem, since when, and location.
- AC2: It produces a formatted letter (To, Subject, Body, Date, Name) that I can share or print.

**US-28** — As a user, I want to ask "Ayushman card kaise banega?" and get simple steps, so that I understand the process.
- AC1: The answer comes from the catalogue data and links to the scheme page.

**US-29** — As a user who types "bachao" into Sahayak, I want the SOS button shown immediately.

---

## 7. MVP scope

### 7.1 MVP definition
The MVP is what we demonstrate at **Final Review-III** and pilot in Mahodiya. It is also split across the course phases:

| Course milestone | What must work by then |
|---|---|
| **Progress Review-1 + Phase I report** (Semester 5, ≥40% of the proposed work) | Auth, i18n shell and govt-style UI, SOS end-to-end (trigger → contacts → dashboard pin), complaint submission with AI category, schemes browse + detail, emergency numbers. Deployed on a public URL. |
| **Progress Review-II** (Semester 6, week after CAT I) | Complaint lifecycle in the authority dashboard, eligibility checker, blood donor module, nearby services, live SOS map, Sahayak v1 (scheme Q&A). |
| **Final Review-III + final report** (Semester 6) | Sahayak letter drafting, analytics, PWA/offline, field pilot results, polish and accessibility pass. |

### 7.2 In scope for MVP
All **P0** and **P1** requirements in Section 5.

### 7.3 Out of MVP (P2, "next")
FR-CMP-11 duplicate hints, FR-SCH-07 read-aloud, FR-SHK-08 voice input, and everything in Section 9.

---

## 8. Success metrics

### 8.1 Pilot metrics (Mahodiya field pilot, 4 weeks)
These are **targets for the pilot**, to be measured and reported honestly even if we miss them.

| Metric | Target |
|---|---|
| Registered users from Mahodiya and nearby villages | ≥ 50 |
| Complaints filed | ≥ 20 |
| Complaints that reach RESOLVED or IN_PROGRESS in the pilot | ≥ 40% |
| Users who complete the eligibility checker | ≥ 30 |
| Letters generated with Sahayak | ≥ 15 |
| SOS test drills completed successfully (with volunteers, pre-announced) | 10 of 10 |
| Usability: System Usability Scale (SUS) score from ≥ 10 villagers | ≥ 68 (industry average) |
| Task success in moderated test: "find which schemes you can get" without help | ≥ 70% of participants |

### 8.2 Technical metrics

| Metric | Target |
|---|---|
| SOS: button press → authority dashboard pin | < 5 s (p95) on 4G |
| SOS: button press → SMS app opened pre-filled | < 3 s |
| CNN top-1 accuracy on held-out test set | ≥ 87% |
| CNN inference time (server, CPU) | < 300 ms |
| First load on simulated slow 4G (Lighthouse, mobile) | LCP < 3 s |
| Lighthouse Accessibility score | ≥ 90 |
| Uptime during pilot | ≥ 99% |
| Sahayak answer latency | < 6 s (p90) |

### 8.3 Academic metrics (DSN3099)
- Every review milestone in 7.1 is met on time.
- At least one documented field visit to Mahodiya with photos, interview notes and consent forms.
- Each team member has a clearly identifiable contribution for their individual report.

---

## 9. Features to avoid in version 1

| Feature | Why we are **not** building it in v1 |
|---|---|
| Native Android/iOS app (React Native) | Doubles the work. A PWA covers install, home-screen icon and basic offline. Planned for a later phase. |
| Cyber scam / phishing detection | Removed by the supervisor. Out of scope. |
| OTP login via SMS | Commercial SMS in India requires DLT registration and costs money per message. Password login is enough for the pilot. |
| Server-sent SMS alerts (Twilio/MSG91) | Same DLT and cost reasons. v1 uses the user's own SMS app (free, no approval needed). Revisit for v2. |
| Voice-triggered SOS | Needs always-on microphone access, which browsers don't allow in the background. Native-app feature. |
| Background location tracking | Browsers stop GPS when the tab is closed. Native-app feature. |
| Integration with CPGRAMS / MP CM Helpline / government APIs | We have no official access, and we're an independent project. Show links to those portals instead. |
| Applying for schemes inside the app | We are not an authorised service. We guide, then link to the official portal or office. |
| Payments, donations | Not needed and adds compliance risk. |
| BERT/large custom NLP models | Unnecessary for v1. Sahayak uses a hosted LLM API with our data as context. |
| Crime/complaint heatmaps | Too little data in one village to be meaningful. Revisit at scale. |
| IoT (smart streetlights, CCTV) | Hardware, cost and permissions. |
| Social features (comments, likes, public complaint feed) | Moderation burden and privacy risk in a small village where everyone knows each other. |
| Multiple regional languages beyond Hindi/English | The i18n system supports them, but translation and review take time. Add after the pilot. |
| Dark mode | Outdoor sunlight readability favours one high-contrast light theme. Not needed for v1. |

---

## 10. Assumptions, dependencies and risks

### 10.1 Assumptions
- Most pilot users have access to an Android phone with Chrome and mobile data, even if shared.
- The Panchayat office (or a nominated volunteer) agrees to act as the authority user during the pilot. **This must be confirmed during the field visit.**
- Scheme information can be collected manually from official portals and verified by the team.

### 10.2 Dependencies
Google Maps Platform (Maps JavaScript, Places), Cloudinary, MongoDB Atlas, an LLM API for Sahayak, Vercel and Render hosting. See the Technical Requirements Document (02).

### 10.3 Risks

| Risk | Impact | Mitigation |
|---|---|---|
| No authority user responds to complaints during the pilot | Complaints never move and users lose trust | Get a named Panchayat contact in the field visit. The team acts as a relay (forwards complaints on paper/WhatsApp) and records outcomes. |
| Misuse or false SOS | Wasted responder time | Countdown + cancel, FALSE_ALARM status, drills announced in advance. **An SOS is never blocked.** More than 3 SOS per hour from one account are still sent, but flagged for admin review. |
| Wrong scheme information | Real harm (wasted trips, missed benefits) | Source + last-verified date on every scheme, disclaimer, admin review every month. |
| CNN accuracy lower on real village photos | Wrong routing | The user always confirms the category. The authority can re-categorise. Collect pilot photos (with consent) to retrain. |
| Free-tier hosting sleeps (cold start) | Slow first SOS | Keep-alive ping. SOS SMS opens on the phone even if the server is slow. Paid instance for the pilot and demo if budget allows. |
| LLM cost or outage | Sahayak unavailable | Daily limits, a cheap model, and a fallback message with links to scheme pages. Sahayak is P1, so the rest of the app works without it. |
| Privacy concerns (location, phone numbers) | Loss of trust, legal exposure | Minimal data, consent, masked donor numbers, data retention limits (see doc 05). |

---

## 11. Open questions (to resolve with the team and supervisor)
1. Who exactly will be the authority user in Mahodiya during the pilot (secretary, sarpanch, ASHA worker, or a volunteer)?
2. Which 15–25 schemes go in the first catalogue? The proposed starting list is in doc 05, section 11.
3. Do we have a budget for a paid Render instance and LLM API credits during the pilot? (Estimate: under ₹1,500/month; confirm.)
4. Do we collect real complaint photos from Mahodiya for CNN fine-tuning, and what consent form do we use?
