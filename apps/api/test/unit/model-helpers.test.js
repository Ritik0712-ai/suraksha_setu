import { describe, expect, it } from "vitest";
import { displayNameFrom } from "../../src/models/BloodDonor.js";
import { istYear } from "../../src/models/Counter.js";

describe("displayNameFrom (docs/05 §5.11: no full names in donor search)", () => {
  it.each([
    ["Rahul Sharma", "Rahul S."],
    ["  Pooja   Kumari  Verma ", "Pooja V."],
    ["सुनीता देवी", "सुनीता द."],
    ["Ramesh", "Ramesh"],
    ["", ""],
  ])("%j → %j", (name, expected) => {
    expect(displayNameFrom(name)).toBe(expected);
  });
});

describe("istYear", () => {
  it("rolls over at midnight IST, not UTC", () => {
    expect(istYear(new Date("2026-12-31T18:29:59Z"))).toBe(2026); // 23:59:59 IST
    expect(istYear(new Date("2026-12-31T18:30:00Z"))).toBe(2027); // 00:00 IST, 1 Jan
  });
});
