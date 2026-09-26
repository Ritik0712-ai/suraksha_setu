import { describe, expect, it } from "vitest";
import { evaluateCondition, evaluateScheme } from "../../src/modules/schemes/eligibility.js";

const r = (hi) => ({ hi, en: hi });
const female = { field: "gender", op: "eq", value: "female", failReason: r("women only") };
const age = {
  field: "ageBand",
  op: "in",
  value: ["21_40", "41_60"],
  failReason: r("age 21-60"),
  unknownReason: r("age checked"),
};
const income = {
  field: "incomeBand",
  op: "in",
  value: ["lt_1l"],
  failReason: r("income too high"),
  unknownReason: r("income checked"),
};

describe("eligibility checker (docs/05 §5.8.1)", () => {
  it("evaluates conditions to true / false / unknown", () => {
    expect(evaluateCondition(female, { gender: "female" })).toBe(true);
    expect(evaluateCondition(female, { gender: "male" })).toBe(false);
    expect(evaluateCondition(female, {})).toBeNull();
    expect(evaluateCondition(income, { incomeBand: "dont_know" })).toBeNull();
    expect(evaluateCondition({ ...female, op: "neq" }, { gender: "male" })).toBe(true);
    expect(evaluateCondition({ ...age, op: "nin" }, { ageBand: "gt_60" })).toBe(true);
  });

  it("likely when every condition is true and nothing must always be checked", () => {
    expect(
      evaluateScheme(
        { all: [female, age], any: [], alwaysCheck: [] },
        { gender: "female", ageBand: "21_40" },
      ),
    ).toEqual({ result: "likely", reasons: [] });
  });

  it("no with the failing condition's reason", () => {
    const out = evaluateScheme({ all: [female, age] }, { gender: "male", ageBand: "21_40" });
    expect(out).toEqual({ result: "no", reasons: [r("women only")] });
  });

  it("maybe with unknown reasons and always-check notes", () => {
    const out = evaluateScheme(
      { all: [female, income], alwaysCheck: [r("samagra")] },
      { gender: "female", incomeBand: "dont_know" },
    );
    expect(out).toEqual({ result: "maybe", reasons: [r("income checked"), r("samagra")] });
  });

  it("any: one true is enough; all false → no; unknown → maybe", () => {
    const rules = { all: [], any: [female, age] };
    expect(evaluateScheme(rules, { gender: "male", ageBand: "21_40" }).result).toBe("likely");
    expect(evaluateScheme(rules, { gender: "male", ageBand: "gt_60" }).result).toBe("no");
    expect(evaluateScheme(rules, { gender: "male" }).result).toBe("maybe");
  });

  it("no rules → maybe, check at the office", () => {
    expect(evaluateScheme(null, {}).result).toBe("maybe");
    expect(evaluateScheme({ all: [], any: [], alwaysCheck: [] }, {}).result).toBe("maybe");
  });
});
