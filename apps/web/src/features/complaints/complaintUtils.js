import { useTranslation } from "react-i18next";
import C from "../../config/constants.js";
import { toTenDigits } from "../../lib/phone.js";

export const CATEGORIES = C.complaintCategories;

/** Picks the current language from a { hi, en } name. */
export function useLocalized() {
  const { i18n } = useTranslation();
  const lang = i18n.resolvedLanguage === "en" ? "en" : "hi";
  return (name) => (name ? (name[lang] ?? name.hi ?? name.en ?? "") : "");
}

/** docs/03 S-10 step 2: ≥ 0.85 "very sure", 0.60–0.84 "fairly sure", below that not shown. */
export function confidenceLabel(confidence) {
  if (confidence >= 0.85) return "verySure";
  if (confidence >= 0.6) return "fairlySure";
  return null;
}

/** POST /complaints body from the S-10 draft. */
export function buildComplaintBody(d) {
  const body = { category: d.category };
  if (d.upload) body.uploadId = d.upload.uploadId;
  if (d.location)
    body.location = {
      lat: d.location.lat,
      lng: d.location.lng,
      ...(d.location.accuracyM ? { accuracyM: d.location.accuracyM } : {}),
    };
  if (d.landmark.trim()) body.landmark = d.landmark.trim();
  if (d.description.trim()) body.description = d.description.trim();
  if (d.onBehalf && d.onBehalfName.trim()) {
    const ten = toTenDigits(d.onBehalfPhone);
    body.onBehalfOf = { name: d.onBehalfName.trim(), ...(ten ? { phone: `+91${ten}` } : {}) };
  }
  return body;
}

const FLOW = ["SUBMITTED", "VERIFIED", "ASSIGNED", "IN_PROGRESS", "RESOLVED"];

/**
 * Turns the public timeline into the S-13 stepper: one step per status in FLOW, each with its
 * latest date and the public notes made while it was current. A rejected complaint ends with a
 * red REJECTED step after the last status it reached.
 */
export function buildSteps(complaint) {
  const steps = new Map(FLOW.map((s) => [s, { status: s, at: null, notes: [] }]));
  steps.set("REJECTED", { status: "REJECTED", at: null, notes: [] });
  let current = "SUBMITTED";
  let lastBeforeReject = "SUBMITTED";
  for (const e of complaint.timeline) {
    if (e.toStatus) {
      if (e.toStatus === "REJECTED") lastBeforeReject = current;
      current = e.toStatus;
      steps.get(current).at = e.at;
    }
    if (e.text || e.type === "reopened" || e.type === "public_note")
      steps.get(current).notes.push({ type: e.type, text: e.text, at: e.at });
  }
  const status = complaint.status;
  if (status === "REJECTED") {
    const reached = FLOW.slice(0, FLOW.indexOf(lastBeforeReject) + 1).map((s) => steps.get(s));
    return { steps: [...reached, steps.get("REJECTED")], active: reached.length };
  }
  return { steps: FLOW.map((s) => steps.get(s)), active: FLOW.indexOf(status) };
}
