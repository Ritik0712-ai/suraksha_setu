import { describe, expect, it } from "vitest";
import { maskPhone, normalizePhone } from "../../src/lib/phone.js";

describe("normalizePhone", () => {
  it.each([
    ["9876543210", "+919876543210"],
    ["98765 43210", "+919876543210"],
    ["+91 98765-43210", "+919876543210"],
    ["919876543210", "+919876543210"],
    ["09876543210", "+919876543210"],
    [9876543210, "+919876543210"],
    ["6000000000", "+916000000000"],
  ])("%s → %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each([
    "5876543210",
    "987654321",
    "98765432101",
    "abcdefghij",
    "",
    null,
    undefined,
    "+1 9876543210",
  ])("rejects %s", (input) => {
    expect(normalizePhone(input)).toBeNull();
  });
});

describe("maskPhone", () => {
  it("shows the first 2 and last 3 digits (docs/03 S-27)", () => {
    expect(maskPhone("+919876543210")).toBe("+91 98XXX XX210");
  });
});
