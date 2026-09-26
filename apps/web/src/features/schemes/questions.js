import C from "../../config/constants.js";

// docs/03 S-16 question order and skip logic. Values come from shared/constants.json.
export const QUESTION_ORDER = [
  "forWhom",
  "gender",
  "ageBand",
  "maritalStatus",
  "occupation",
  "incomeBand",
  "socialCategory",
  "rationCard",
  "disability",
];

export const optionsFor = (field) => C.eligibilityAnswers[field];

/** The questions to ask for the answers so far (and what the profile already tells us). */
export function activeQuestions(answers, profileGender) {
  return QUESTION_ORDER.filter((f) => {
    if (f === "gender") return !(answers.forWhom === "self" && profileGender);
    if (f === "maritalStatus")
      return answers.gender === "female" && ["21_40", "41_60"].includes(answers.ageBand);
    return true;
  });
}

/** Drops answers to questions that no longer apply (e.g. marital status after a gender change). */
export function cleanAnswers(answers, profileGender) {
  const keep = new Set(activeQuestions(answers, profileGender));
  const out = {};
  for (const [k, v] of Object.entries(answers)) if (keep.has(k)) out[k] = v;
  if (answers.forWhom === "self" && profileGender) out.gender = profileGender;
  return out;
}
