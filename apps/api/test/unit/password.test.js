import { describe, expect, it } from "vitest";
import { hashPassword, passwordIssue, verifyPassword } from "../../src/lib/password.js";

describe("passwordIssue (docs/02 §6.1)", () => {
  it("accepts 8+ characters that aren't only digits", () => {
    expect(passwordIssue("abcd1234")).toBeNull();
    expect(passwordIssue("सुरक्षा सेतु 1")).toBeNull();
  });

  it.each([
    ["", "required"],
    ["abc123", "too_short"],
    ["12345678", "only_digits"],
    ["क".repeat(25), "too_long"], // 75 bytes > bcrypt's 72
  ])("%s → %s", (pw, issue) => {
    expect(passwordIssue(pw)).toBe(issue);
  });
});

describe("hashPassword / verifyPassword", () => {
  it("round-trips and never stores the plain password", async () => {
    const hash = await hashPassword("abcd1234", 4);
    expect(hash).not.toContain("abcd1234");
    expect(await verifyPassword("abcd1234", hash)).toBe(true);
    expect(await verifyPassword("abcd12345", hash)).toBe(false);
  });
});
