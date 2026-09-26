# Suraksha Setu — UI/UX Design Brief

| | |
|---|---|
| **Document** | 04 — UI/UX Design Brief |
| **Version** | 1.0 (draft for team review) |
| **Date** | 26 September 2026 |
| **Based on** | 01 PRD · 03 App Flow · supervisor's design direction |
| **For** | Designers on the team and any AI app builder/coding agent |

This brief defines **how Suraksha Setu looks and feels**. Screen contents and behaviour are in doc 03. When they disagree on visuals, this document wins.

---

## 1. Design direction in one paragraph

Suraksha Setu should feel like a **clean, trustworthy public-service portal**, closer to UIDAI, DigiLocker, AIIMS or myScheme than to a startup app. It uses a white background, deep navy structure, saffron accents, big icons, big buttons, plain Hindi and no visual noise. Someone who has never used an app like this, who reads Hindi slowly, and who is standing outside in sunlight on a ₹7,000 Android phone should be able to find SOS, report a broken handpump and check a scheme **without help**.

### 1.1 Mood words
Trustworthy · calm · clear · respectful · local · sturdy.

### 1.2 Not this
Glassmorphism, gradients, neon, dark themes, tiny grey text, English-only icons with no labels, playful illustrations of city life, animations that delay actions, and "startup" hero sections.
The earlier dark navy/cyan glassmorphism slide theme is **retired** for the product UI.

### 1.3 The independent-project rule (important)
The look is *inspired by* government portals, but the app **must not look like an official government service**:
- **Do not use** the State Emblem of India (Ashoka Lion Capital), "Government of India / भारत सरकार", ministry names, `gov.in`-style branding, or any official department's logo.
- **Do use** our own logo (a bridge + shield mark) and the footer disclaimer on every page (doc 03, section 2.1).
- The tricolour strip at the top is allowed as a **thin decorative band only** (4 px). No flag imagery elsewhere.

---

## 2. User experience principles

1. **Icon first, words second, and never icon alone.** Every action has a recognisable pictogram and a short label (1–3 words). Labels appear in the selected language.
2. **One screen, one job.** Each screen has one obvious primary button. Secondary actions are visibly quieter.
3. **Big targets, forgiving input.** Touch targets are at least 48 × 48 px with 8 px between them. Phone numbers accept any format (spaces, +91, leading 0) and clean it up automatically.
4. **SOS is always one tap away, and never an accident.** It's reachable from every citizen screen (bottom nav/header), and the 5-second countdown with a giant Cancel button prevents false alarms.
5. **Plain, spoken Hindi.** Write the way people talk in Sehore, not formal government Hindi. Use "शिकायत करें", not "परिवाद प्रस्तुत करें". Common English loanwords people actually use (SOS, mobile, photo, app, online) stay as they are.
6. **Show progress and status in words.** Steps are numbered ("Step 2 of 4"). Status chips always include text + icon, not just colour.
7. **Low data, low patience.** Show content immediately with skeletons, compress photos, prefer lists to maps, and lazy-load maps and charts.
8. **Earn trust with sources.** Every scheme shows its official source and last-checked date. AI suggestions are labelled "AI" and can always be changed.
9. **Respect privacy visibly.** Masked phone numbers, a clear consent screen, and "who can see this" hints on sensitive fields.
10. **Consistent everywhere.** The same component always means the same thing (for example, red = emergency only, never "delete").

---

## 3. Color palette

All values are checked against WCAG 2.1 contrast (ratios shown are measured against the background given).

### 3.1 Core tokens

| Token | Hex | Use | Contrast |
|---|---|---|---|
| `navy-900` | `#00264D` | Portal sidebar background, footer background | White text 15.2:1 |
| `navy-700` **(primary)** | `#003366` | Primary buttons, header text, links, active nav, headings | 12.6:1 on white |
| `navy-100` | `#E8EEF6` | Selected tile/chip background, info panels | Navy text 10.8:1 |
| `saffron-500` | `#FF6600` | **Decorative only:** tricolour strip, icon accents, illustration highlights, 4 px left borders on highlight cards. **Never as text on white** (2.9:1 fails). | — |
| `saffron-700` | `#C2410C` | Saffron text/links on white, secondary accent buttons (white text), focus ring | 5.2:1 on white |
| `saffron-50` | `#FFF4E5` | Highlight card background (eligibility CTA, tips) | Body text 16.0:1 |
| `sos-red` | `#C62828` | SOS button, emergency bar, SOS status, destructive-in-emergency only | White text 5.6:1 |
| `sos-red-50` | `#FDECEC` | SOS-related backgrounds | — |
| `green-700` | `#0B6E0B` | Success, "Likely eligible", RESOLVED, "I am safe" button | White text 6.5:1 |
| `green-500` | `#138808` | Tricolour strip green only | — |
| `amber-700` | `#B45309` | Warnings, "Maybe", pending states, outdated-info notes | 5.0:1 on white |
| `amber-50` | `#FFF8E1` | Warning/offline banner background | — |
| `ink-900` | `#1A1A1A` | Body text | 17.4:1 on white |
| `ink-600` | `#4B5563` | Secondary text, captions | 7.6:1 on white |
| `ink-500` | `#6B7280` | Placeholder text (only as a hint, never as the label) | 4.8:1 on white |
| `line-strong` | `#7A8699` | Input borders, checkbox outlines (needs ≥ 3:1) | 3.7:1 on white |
| `line-soft` | `#D0D7E2` | Card borders, dividers (decorative) | — |
| `surface` | `#F4F6FA` | Page section background, table stripes | — |
| `white` | `#FFFFFF` | Main background, cards | — |
| `info-600` | `#1565C0` | Info icons/links inside notices only | 5.8:1 on white |

### 3.2 Rules
- **Red means emergency.** Only SOS, the emergency bar, active SOS pins and the SOS status use `sos-red`. Destructive actions (delete) use a red **text** button inside confirmation dialogs; never a big red filled button that could be confused with SOS.
- **Saffron is an accent, not a primary.** Max ~10% of any screen.
- **Never convey meaning by colour alone.** Status = colour + icon + text.
- **One theme only (light).** No dark mode in v1 (outdoor sunlight readability). The UI must still respect a user's forced-colours / high-contrast mode (don't hide focus outlines, use real borders).

### 3.3 Status colour mapping

| Status | Chip style | Icon (Material Symbols) |
|---|---|---|
| SUBMITTED | `navy-100` bg, `navy-700` text | `send` |
| VERIFIED | `navy-100` bg, `navy-700` text | `verified` |
| ASSIGNED | `saffron-50` bg, `saffron-700` text | `assignment_ind` |
| IN_PROGRESS | `amber-50` bg, `amber-700` text | `construction` |
| RESOLVED | `#E6F4E6` bg, `green-700` text | `check_circle` |
| REJECTED | `surface` bg, `ink-600` text | `block` |
| SOS ACTIVE | `sos-red` bg, white text | `emergency` (pulsing dot) |
| SOS ACKNOWLEDGED | `amber-50` bg, `amber-700` text | `visibility` |
| SOS RESOLVED | `#E6F4E6` bg, `green-700` text | `verified_user` |

---

## 4. Typography

### 4.1 Typeface
- **Noto Sans** (Latin) + **Noto Sans Devanagari** (Hindi), self-hosted, `font-display: swap`. Weights **400, 500 and 700** only.
- Font stack: `"Noto Sans", "Noto Sans Devanagari", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`.
- Numbers: use Western Arabic numerals (1, 2, 3) in both languages. They're more familiar on phones and in phone numbers.

### 4.2 Scale (base = 18 px at the default text size "A")

| Style | Size / line-height | Weight | Use |
|---|---|---|---|
| Display | 32 / 40 | 700 | S-06 countdown number is separate (96 px); success headlines |
| H1 | 28 / 36 | 700 | Page titles |
| H2 | 24 / 32 | 700 | Section titles |
| H3 | 20 / 28 | 500 | Card titles, tile labels on desktop |
| Body | 18 / 28 | 400 | Default text |
| Body-strong | 18 / 28 | 500 | Emphasis, button labels |
| Small | 16 / 24 | 400 | Captions, helper text, table cells in portal |
| Micro | 14 / 20 | 500 | Badges, timestamps only. **Nothing smaller than 14 px anywhere.** |

- **Devanagari needs more line height.** Keep body line-height ≥ 1.55 so matras (ि ी ु ू) don't collide. Don't use negative letter-spacing.
- **Text-size control:** A− sets the root to 16 px, A to 18 px, A+ to 21 px. Everything is in `rem`, so layouts scale. Test every screen at A+ on a 360 px screen (no truncation of primary labels, no horizontal scroll).
- Hindi strings are usually 20–40% longer than English. Design every label with that length in mind (allow 2 lines on tiles).
- Portal (desktop, dense tables) may use a 16 px base, but the text-size control still applies.

---

## 5. Layout direction

### 5.1 Grid and spacing
- **Mobile-first**, baseline **360 × 640**.
- Spacing scale (8-point): 4, 8, 12, 16, 24, 32, 48, 64 px. Page side padding: 16 px (mobile), 24 px (tablet), 32 px (desktop).
- Content max width: **1200 px** (citizen), full width (portal, with a 240 px sidebar).
- Columns: 4 (mobile) · 8 (tablet) · 12 (desktop), 16 px gutters.
- Border radius: **8 px** for cards, inputs and buttons; **16 px** for module tiles and bottom sheets; **999 px** for chips and the SOS button. Keep it sturdy, not bubbly.
- Elevation: flat design with 1 px borders. Only one shadow level (`0 2px 8px rgba(0, 38, 77, 0.08)`) for raised elements: the bottom nav, the floating action button, dialogs.

### 5.2 Citizen app structure (mobile)

```
┌──────────────────────────────┐
│▓▓▓▓▓▓▓▓░░░░░░░░░▒▒▒▒▒▒▒▒▒▒▒▒│  4px tricolour strip
│ [logo] सुरक्षा सेतु  EN|हि Aa 🔔│  56px header (white, navy text, bottom border)
│ 📞 आपातकाल? 112 पर कॉल करें   │  44px emergency bar (sos-red)
├──────────────────────────────┤
│                              │
│   page content (scrolls)     │
│                              │
│   footer disclaimer          │
├──────────────────────────────┤
│ 🏠   📜   (🆘)   💬   👤      │  64px bottom nav (SOS raised, 64px circle)
└──────────────────────────────┘
```

### 5.3 Home screen composition
1. Greeting (H2).
2. SOS card: full width, `sos-red` background, white text, 120 px tall, big "SOS" label and one line of text. It's the most prominent element above the fold.
3. Module tiles: 2 × N grid, each tile square (min 150 × 150 px on 360 px screens), white with a `line-soft` border, a 48 px icon in a 72 px tinted circle (`navy-100`; saffron tint for Schemes, light red for Blood), and a label below (H3, max 2 lines, centred).
4. Secondary cards (setup prompt, recent activity): full width.

### 5.4 Forms
- One column. Labels **above** the field (never placeholder-only). Helper text below in `ink-600`.
- Inputs: 56 px tall, 1 px `line-strong` border, 8 px radius, 18 px text. Focus: 2 px `navy-700` border + 3 px `saffron-700` outer ring.
- Error: red text + an error icon below the field and a red border. The message says what to do ("Enter a 10-digit mobile number"), not just "Invalid".
- Primary button full width at the bottom of the form. On long forms, it sticks to the bottom of the viewport.
- Use the right keyboards: `inputmode="numeric"` for phone/OTP, `type="email"`, `autocomplete` attributes.

### 5.5 Wizards (complaint, eligibility)
- Progress bar + "Step X of Y" at the top.
- **One question or one decision per screen.** Large option buttons (min 64 px tall) with icons. Tapping an option auto-advances in the eligibility checker. The complaint wizard uses an explicit **Next** because steps have multiple inputs.
- **Back** is always available and keeps the answers.

---

## 6. Component style

Use **MUI v5** components with the theme in section 11. The rules below override MUI defaults.

### 6.1 Buttons

| Variant | Style | Use |
|---|---|---|
| Primary | `navy-700` fill, white text, 56 px tall (48 px in the portal), 8 px radius, 18 px medium | Main action per screen |
| Secondary | White fill, 2 px `navy-700` border, navy text | Alternative action |
| Accent | `saffron-700` fill, white text | Rare: "Check eligibility" CTA only |
| SOS | `sos-red` fill, white text, circular (200 px on S-06, 64 px in the nav), 4 px white ring + soft red outer glow | SOS only |
| Safe | `green-700` fill, white text | "I am safe", "Yes, correct" |
| Text | No fill, `navy-700` text, underline on hover/focus | Tertiary links |
| Danger text | No fill, `sos-red` text | Delete/remove inside dialogs only |

- Icons sit to the left of the label, 24 px.
- Loading: the label is replaced by a spinner with the same width; the button is disabled.
- Disabled: 40% opacity plus a caption explaining why when it isn't obvious ("Needs internet").
- **No button text in ALL CAPS** (MUI default off). Caps hurt readability and don't exist in Hindi anyway.

### 6.2 Cards and tiles
- White, 1 px `line-soft` border, 8 px radius (tiles 16 px), 16 px padding.
- Clickable cards show a chevron (›) or an explicit button, and get a `navy-100` background on press.
- Highlight cards: 4 px left border in `saffron-500` + `saffron-50` background.
- Warning cards: `amber-50` background + `amber-700` icon and title.

### 6.3 Chips
- Filter chips: 40 px tall, 1 px `line-strong` border, selected = `navy-700` fill + white text + check icon.
- Status chips: see 3.3. 32 px tall, icon + text, never truncated.

### 6.4 Navigation
- **Bottom nav (citizen, mobile):** 5 items, icon (28 px) + label (14 px) for each; the active item is `navy-700` with a 3 px top bar; inactive is `ink-600`. The centre SOS item is a 64 px red circle raised 16 px above the bar with the white label "SOS".
- **Header nav (citizen, desktop):** text links with icons, active = underline in `saffron-500` (decorative) + bold navy text.
- **Portal sidebar:** `navy-900` background, white text, 48 px items, active = `navy-700` background + 4 px `saffron-500` left border. The Live SOS item badge is a `sos-red` pill.

### 6.5 Dialogs and bottom sheets
- Mobile: bottom sheets (16 px top radius) with a drag handle. Desktop: centred dialogs, max 560 px wide.
- Title (H3), one or two sentences, actions at the bottom right (desktop) or stacked full-width (mobile), with the primary action last (rightmost/bottom).

### 6.6 Feedback
- **Toast/snackbar:** bottom, above the bottom nav, `ink-900` background, white text, icon, 4 s. One at a time.
- **Inline notices:** full-width boxes with icon + title + text (info = navy-100, warning = amber-50, error = sos-red-50 with red icon, success = green tint).
- **Skeletons:** `surface` blocks with a subtle shimmer (disabled with `prefers-reduced-motion`).
- **Empty states:** 96 px line icon in `navy-100` circle + H3 + one sentence + one button.

### 6.7 Maps
- Google Maps with a **simplified style**: reduced POI clutter, muted colours, roads visible, labels in the current language where Google supports it.
- Markers: custom SVG pins with a type icon inside (hospital, police, fire, pharmacy, ambulance, complaint category, SOS). SOS pins are red with a pulsing ring; the user's location is a blue dot with an accuracy circle.
- Maps are never the only way to see information. There's always a list alternative.

### 6.8 Chat (Sahayak)
- User bubbles: right-aligned, `navy-700` background, white text, 16 px radius (4 px bottom-right).
- Sahayak bubbles: left-aligned, `surface` background, `ink-900` text, with a small Sahayak avatar (a friendly lamp/diya-style or helper icon; **not** a human face, so it isn't mistaken for a person).
- Quick-reply chips below the last Sahayak message; scheme cards appear as compact cards inside the thread.
- The emergency card inside chat uses the full SOS styling (red, big buttons).

### 6.9 Letter preview
- Looks like paper: white, 1 px border, a subtle shadow, 24 px padding, serif-free Noto Sans, left-aligned formal layout (doc 03, S-26). Print CSS: A4, 2 cm margins, black text, no app chrome.

### 6.10 Tables (portal)
- 48 px rows, zebra stripes (`surface`), sticky header, sortable column icons, row hover `navy-100`.
- The first column (ID) is monospaced (`Noto Sans Mono` fallback to `monospace`), with a copy button on hover.
- On mobile (< 900 px) tables become stacked cards.

### 6.11 Iconography
- **Material Symbols Rounded**, weight 400, grade 0, optical size 24/48. Subset the font to the icons we use.
- Suggested module icons: SOS `emergency` · Complaints `photo_camera` · Schemes `volunteer_activism` (avoid `account_balance`, which looks like an official building) · Blood `bloodtype` · Emergency services `local_hospital` · Sahayak: custom helper icon (fallback `support_agent`) · Authority `admin_panel_settings` · Fake call `call`.
- Complaint categories: road `add_road` / `construction`, garbage `delete`, streetlight `lightbulb`, waterlogging `water`, water supply `water_pump` (or a custom handpump icon — **recommended**, since handpumps are central in Mahodiya), encroachment `fence`, other `more_horiz`.
- Custom icons (if made) follow the same 24 px grid, 2 px stroke, rounded caps.

### 6.12 Imagery and illustration
- Simple flat illustrations of **rural Indian settings**: village lanes, handpumps, women in everyday clothes, farmers, Panchayat buildings. Diverse, respectful, and not stereotyped.
- Two-colour style (navy + saffron on white) for empty states and onboarding.
- Photos only for user uploads. No stock photos of cities or smiling models.

### 6.13 Logo
- A bridge arch combined with a shield outline, navy with a saffron keystone. The wordmark shows "सुरक्षा सेतु" (primary) above "Suraksha Setu".
- Minimum size 32 px (mark only). Must not include the national emblem, flag or wheel.

---

## 7. Authority dashboard structure

### 7.1 Layout (desktop ≥ 1200 px)

```
┌───────────┬──────────────────────────────────────────────────┐
│ LOGO      │ Overview            [Mahodiya ▾]  EN|हि  🔔  👤    │
│           ├──────────────────────────────────────────────────┤
│ Overview  │ ┌────────┐┌────────┐┌────────┐┌────────┐          │
│ Complaints│ │ Open   ││Resolved││ Active ││ Avg.   │ KPI row  │
│ Live SOS 2│ │  23    ││ this wk││  SOS 2 ││ 4.2 d  │          │
│ Analytics │ └────────┘└────────┘└────────┘└────────┘          │
│───────────│ ┌──────────────────────────────────────────┐      │
│ ADMIN     │ │ 🔴 Active SOS strip (cards)               │      │
│ Users     │ └──────────────────────────────────────────┘      │
│ Schemes   │ ┌─────────────────────────┐┌───────────────┐      │
│ Emergency │ │ Complaints needing action││ Activity feed │      │
│ Depts     │ │ (table, 10 rows)        ││ (15 items)    │      │
│ Areas     │ └─────────────────────────┘└───────────────┘      │
│ Audit     │                                                  │
│───────────│                                                  │
│ 👤 Verma  │                                                  │
└───────────┴──────────────────────────────────────────────────┘
```

### 7.2 KPI cards
- White card, 1 px border, 16 px padding: label (Small, `ink-600`) · big number (Display, navy) · a trend line or a delta ("+3 vs last week", green/amber with an arrow icon).
- The Active SOS card turns `sos-red` with white text when the value > 0.

### 7.3 Charts (MUI X Charts)
- A single categorical palette for charts, in this order: `#003366` (navy), `#C2410C` (saffron-700), `#0B6E0B` (green), `#6B7280` (grey), `#1565C0` (blue), `#B45309` (amber), `#6A1B9A` (purple).
- Always show axis labels, direct value labels on bars where space allows, and a legend only when there's more than 1 series.
- Every chart has a text title stating the takeaway, e.g. "Water supply is the top complaint (41%)", plus a "Download CSV" icon.
- No 3D, no pie charts with more than 4 slices (use bars).

### 7.4 Live SOS map
- The map takes ~70% of the width; the list panel takes 30% (360 px min).
- A new SOS gets a 3-second highlight animation on its list item + a red banner on all portal pages (doc 03, section 2.6).
- Connection indicator is always visible (Live ● / Reconnecting…).

---

## 8. Mobile responsiveness

| Breakpoint | Width | Citizen app | Portal |
|---|---|---|---|
| `xs` | 0–599 | Bottom nav, 2-column tiles, full-width cards, bottom sheets | Hamburger drawer, cards instead of tables, KPIs 2 × 2 |
| `sm` | 600–899 | Bottom nav, 3-column tiles | Hamburger drawer, KPIs 2 × 2, tables scroll horizontally inside their card |
| `md` | 900–1199 | Header nav (no bottom nav), 4-column tiles, content max 1200 | Sidebar collapsed to icons (72 px) with tooltips |
| `lg` | ≥ 1200 | As md | Full sidebar (240 px) |

**Rules**
- No horizontal page scroll at any width (except tables inside their own scroll container).
- Test at **360 × 640** (baseline Android), 390 × 844, 768 × 1024, 1366 × 768.
- Test at text size A+ on 360 px.
- Primary actions stay in the thumb zone on mobile (bottom half). Wizard "Next" buttons stick to the bottom.
- Respect safe areas (`env(safe-area-inset-bottom)`) for the bottom nav.
- Landscape on phones: the layout must still work. The SOS countdown stays centred.

---

## 9. Accessibility checklist (WCAG 2.1 AA)

- [ ] Text contrast ≥ 4.5:1 (≥ 3:1 for text ≥ 24 px regular / 19 px bold). UI component borders ≥ 3:1.
- [ ] Focus is always visible (section 5.4). Keyboard order follows visual order. No keyboard traps (dialogs trap focus and return it on close).
- [ ] Every icon-only control (e.g. the bell) has an accessible name in the current language.
- [ ] Form fields have programmatic labels, and errors are linked with `aria-describedby`.
- [ ] Status changes (toasts, SOS checklist, chat replies) are announced via `aria-live="polite"`. The SOS countdown uses `aria-live="assertive"`.
- [ ] `lang="hi"` or `lang="en"` on `<html>` (and on mixed-language spans), so screen readers pronounce correctly.
- [ ] Touch targets ≥ 48 × 48 px.
- [ ] `prefers-reduced-motion`: disable the pulse, shimmer and slide transitions (the countdown number still changes).
- [ ] Images: meaningful `alt` text (complaint photos: "Photo of <category> reported on <date>").
- [ ] Content still works at 200% browser zoom.
- [ ] Lighthouse Accessibility ≥ 90 on every main screen.

---

## 10. Microcopy guide

### 10.1 Voice
Warm, respectful, direct. Address users with **आप**. Short sentences (≤ 12 words). Tell people what to do next. Never blame the user.

### 10.2 Key strings

| Key | English | Hindi |
|---|---|---|
| `home.greeting` | Namaste 🙏 | नमस्ते 🙏 |
| `sos.button` | SOS | SOS |
| `sos.countdown` | Sending SOS in {{n}}… | {{n}} सेकंड में SOS जाएगा… |
| `sos.cancel` | Cancel | रद्द करें |
| `sos.sendNow` | Send now | अभी भेजें |
| `sos.active` | SOS is active | SOS चालू है |
| `sos.safe` | I am safe | मैं सुरक्षित हूँ |
| `sos.smsHint` | Tap Send in your SMS app | SMS ऐप में "भेजें" दबाएँ |
| `emergencyBar` | Emergency? Call 112 | आपातकाल? 112 पर कॉल करें |
| `complaint.new` | Report a problem | शिकायत करें |
| `complaint.takePhoto` | Take photo | फ़ोटो खींचें |
| `complaint.aiChecking` | AI is checking the photo… | AI फ़ोटो देख रहा है… |
| `complaint.aiThinks` | AI thinks: {{category}} | AI के अनुसार: {{category}} |
| `complaint.submitted` | Complaint submitted! | शिकायत दर्ज हो गई! |
| `schemes.title` | Government schemes | सरकारी योजनाएं |
| `schemes.check` | Which schemes are for you? | कौन-सी योजना आपके लिए है? |
| `schemes.likely` | Likely eligible | शायद पात्र |
| `schemes.maybe` | Maybe — check | जाँच करें |
| `schemes.no` | Not eligible | पात्र नहीं |
| `schemes.disclaimer` | Final eligibility is decided by the government office. | अंतिम पात्रता सरकारी कार्यालय तय करेगा। |
| `blood.find` | Find blood donors | रक्तदाता खोजें |
| `sahayak.hello` | Hi! I'm Sahayak. How can I help? | नमस्ते! मैं सहायक हूँ। बताइए, कैसे मदद करूँ? |
| `error.network` | Couldn't load. Check your internet. | लोड नहीं हो सका। इंटरनेट जाँचें। |
| `common.retry` | Try again | फिर से कोशिश करें |
| `footer.disclaimer` | An independent student project of VIT Bhopal. Not a government service. | VIT भोपाल का स्वतंत्र छात्र प्रोजेक्ट। यह सरकारी सेवा नहीं है। |

All translations must be **reviewed by a native Hindi speaker from the team and, ideally, tested with 3–5 villagers** during the field visit.

---

## 11. Design tokens for the builder

### 11.1 CSS variables

```css
:root {
  --c-navy-900: #00264D;  --c-navy-700: #003366;  --c-navy-100: #E8EEF6;
  --c-saffron-500: #FF6600; --c-saffron-700: #C2410C; --c-saffron-50: #FFF4E5;
  --c-sos: #C62828; --c-sos-50: #FDECEC;
  --c-green-700: #0B6E0B; --c-green-500: #138808; --c-green-50: #E6F4E6;
  --c-amber-700: #B45309; --c-amber-50: #FFF8E1;
  --c-info-600: #1565C0;
  --c-ink-900: #1A1A1A; --c-ink-600: #4B5563; --c-ink-500: #6B7280;
  --c-line-strong: #7A8699; --c-line-soft: #D0D7E2;
  --c-surface: #F4F6FA; --c-white: #FFFFFF;

  --font-sans: "Noto Sans", "Noto Sans Devanagari", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --radius-sm: 8px; --radius-lg: 16px; --radius-pill: 999px;
  --shadow-raised: 0 2px 8px rgba(0, 38, 77, 0.08);
  --touch-min: 48px;
  --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px;
  --space-5: 24px; --space-6: 32px; --space-7: 48px; --space-8: 64px;
}
html { font-size: 18px; }            /* text size "A" */
html[data-text-size="sm"] { font-size: 16px; }  /* A− */
html[data-text-size="lg"] { font-size: 21px; }  /* A+ */
body { background: var(--c-white); color: var(--c-ink-900); font-family: var(--font-sans); line-height: 1.55; }
```

### 11.2 MUI theme (starting point)

```js
import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    primary:   { main: "#003366", dark: "#00264D", light: "#E8EEF6", contrastText: "#FFFFFF" },
    secondary: { main: "#C2410C", light: "#FFF4E5", contrastText: "#FFFFFF" },
    error:     { main: "#C62828", light: "#FDECEC", contrastText: "#FFFFFF" }, // SOS / emergency
    success:   { main: "#0B6E0B", light: "#E6F4E6", contrastText: "#FFFFFF" },
    warning:   { main: "#B45309", light: "#FFF8E1", contrastText: "#FFFFFF" },
    info:      { main: "#1565C0" },
    text:      { primary: "#1A1A1A", secondary: "#4B5563" },
    divider:   "#D0D7E2",
    background:{ default: "#FFFFFF", paper: "#FFFFFF" },
  },
  typography: {
    fontFamily: '"Noto Sans", "Noto Sans Devanagari", system-ui, sans-serif',
    htmlFontSize: 18,
    fontSize: 18,
    h1: { fontSize: "1.556rem", lineHeight: 1.29, fontWeight: 700 }, // 28px
    h2: { fontSize: "1.333rem", lineHeight: 1.33, fontWeight: 700 }, // 24px
    h3: { fontSize: "1.111rem", lineHeight: 1.4,  fontWeight: 500 }, // 20px
    body1: { fontSize: "1rem", lineHeight: 1.55 },                   // 18px
    body2: { fontSize: "0.889rem", lineHeight: 1.5 },                // 16px
    caption: { fontSize: "0.778rem", lineHeight: 1.43, fontWeight: 500 }, // 14px
    button: { textTransform: "none", fontWeight: 500, fontSize: "1rem" },
  },
  shape: { borderRadius: 8 },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { minHeight: 56, paddingInline: 24 }, sizeSmall: { minHeight: 48 } },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { minHeight: 56 },
        notchedOutline: { borderColor: "#7A8699" },
      },
    },
    MuiChip: { styleOverrides: { root: { height: 40, borderRadius: 999 } } },
    MuiCard: { defaultProps: { variant: "outlined" } },
    MuiButtonBase: { defaultProps: { disableRipple: false } },
    MuiCssBaseline: {
      styleOverrides: {
        "*:focus-visible": { outline: "3px solid #C2410C", outlineOffset: 2 },
      },
    },
  },
});
```

> Note: MUI's `htmlFontSize` must follow the text-size control. Either re-create the theme when the size changes, or keep MUI sizes in `rem` and change only `html { font-size }` (recommended: the second).

---

## 12. Visual references (what to borrow, what to avoid)

| Reference | Borrow | Avoid |
|---|---|---|
| **UIDAI** (uidai.gov.in) | Clean white layout, clear service tiles, navy/saffron restraint, language toggle placement | Dense text blocks, tiny links, official emblem |
| **DigiLocker** (digilocker.gov.in) | Card-based document lists, clear status labels, friendly empty states | Long sign-up flows |
| **AIIMS New Delhi** (aiims.edu) | Trustworthy institutional header, clear hierarchy of important notices | Cluttered homepage with many tickers |
| **myScheme** (myscheme.gov.in) | Eligibility-questionnaire flow, scheme detail structure (benefits → eligibility → documents → how to apply) | English-heavy copy, long filter lists |
| **UMANG app** | Service grid on the home screen, bilingual labels | Too many services on one screen |
| **GOV.UK Design System** (design-system.service.gov.uk) | Accessibility patterns: error messages, question pages ("one thing per page"), focus styles, plain language | UK-specific visual style |
| **Android incoming-call screen** (stock) | Layout for the fake call (S-09b) so it looks believable | — |
| **Google Maps "Share location" page** | Minimal live-location page for S-30 | — |

---

## 13. Motion

- Durations: 150 ms (hover/press), 200–250 ms (dialogs, sheets), no transition longer than 300 ms.
- Easing: standard ease-out.
- Allowed animations: SOS pulse ring (1.5 s loop), countdown ring, skeleton shimmer, toast slide-in, highlight flash for new SOS rows.
- **Nothing may delay an action.** No splash screens or intro animations. All motion respects `prefers-reduced-motion`.

---

## 14. Deliverables expected from design

1. Figma (or equivalent) file with: tokens (section 11), components (section 6), and key screens at 360 px and 1366 px: S-02, S-06, S-07, S-10 (all steps), S-13, S-14, S-15, S-16, S-17, S-20, S-21, S-25, S-26, A-01, A-02, A-03, A-04.
2. Custom icons: handpump, logo, Sahayak avatar.
3. Hindi and English string sheet (reviewed).
4. A usability test script for the Mahodiya field visit (5 tasks: send a test SOS, report a problem, find eligible schemes, find emergency numbers, write a letter with Sahayak).
