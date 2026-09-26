import C from "../../config/constants.js";

// docs/05 §5.8.1: each condition is true, false or unknown; any false → "no"; all true and no
// "always check" notes → "likely"; otherwise "maybe".

const UNKNOWN_VALUES = new Set(C.eligibilityAnswers.unknownValues ?? []);
export const ANSWER_FIELDS = Object.keys(C.eligibilityAnswers).filter(
  (k) => k !== "$comment" && k !== "unknownValues",
);

const NEEDS_CHECK = {
  hi: "यह बात कार्यालय में जाँची जाएगी",
  en: "This will be checked at the office",
};
const NO_RULES = {
  hi: "पात्रता कार्यालय में जाँचें",
  en: "Check eligibility at the office",
};

/** true | false | null (unknown) */
export function evaluateCondition(cond, answers) {
  const a = answers?.[cond.field];
  if (a === undefined || a === null || a === "" || UNKNOWN_VALUES.has(a)) return null;
  switch (cond.op) {
    case "eq":
      return a === cond.value;
    case "neq":
      return a !== cond.value;
    case "in":
      return cond.value.includes(a);
    case "nin":
      return !cond.value.includes(a);
    default:
      return null;
  }
}

/** → { result: "likely"|"maybe"|"no", reasons: [{hi,en}] } */
export function evaluateScheme(rules, answers) {
  if (!rules || (!rules.all?.length && !rules.any?.length && !rules.alwaysCheck?.length))
    return { result: "maybe", reasons: [NO_RULES] };

  const failed = [];
  const unknown = [];
  for (const cond of rules.all ?? []) {
    const v = evaluateCondition(cond, answers);
    if (v === false) failed.push(cond.failReason);
    else if (v === null) unknown.push(cond.unknownReason ?? NEEDS_CHECK);
  }

  const anyList = rules.any ?? [];
  if (anyList.length) {
    const values = anyList.map((c) => evaluateCondition(c, answers));
    if (!values.includes(true)) {
      if (values.includes(null))
        unknown.push(anyList[values.indexOf(null)].unknownReason ?? NEEDS_CHECK);
      else failed.push(anyList[0].failReason);
    }
  }

  if (failed.length) return { result: "no", reasons: failed };
  const reasons = [...unknown, ...(rules.alwaysCheck ?? [])];
  return reasons.length ? { result: "maybe", reasons } : { result: "likely", reasons: [] };
}
