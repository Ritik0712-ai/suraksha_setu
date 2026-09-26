import { describe, expect, it } from "vitest";
import C from "../src/config/constants.js";

// Guards the shared enum file that all three apps depend on.
describe("shared/constants.json", () => {
  it("has a compatibility entry for every blood group, using only valid groups", () => {
    expect(
      Object.keys(C.bloodCompatibility)
        .filter((k) => k !== "$comment")
        .sort(),
    ).toEqual([...C.bloodGroups].sort());
    for (const [recipient, donors] of Object.entries(C.bloodCompatibility)) {
      if (recipient === "$comment") continue;
      expect(donors).toContain(recipient);
      for (const d of donors) expect(C.bloodGroups).toContain(d);
    }
    expect(C.bloodCompatibility["AB+"]).toHaveLength(8);
  });

  it("keeps the 7 CNN classes in the order used by the model", () => {
    expect(C.complaintCategories).toEqual([
      "road_damage",
      "garbage",
      "streetlight",
      "waterlogging",
      "water_supply",
      "encroachment",
      "other",
    ]);
  });

  it("uses UPPER_CASE only for complaint and SOS statuses", () => {
    for (const s of [...C.complaintStatus, ...C.sosStatus]) expect(s).toMatch(/^[A-Z_]+$/);
    for (const s of C.sosOpenStatus) expect(C.sosStatus).toContain(s);
  });

  it("lists every helpline with both languages and 112 first", () => {
    expect(C.helplines[0].number).toBe("112");
    for (const h of C.helplines) {
      expect(h.name.hi).toBeTruthy();
      expect(h.name.en).toBeTruthy();
    }
  });

  it("has Hindi as the default language", () => {
    expect(C.defaultLanguage).toBe("hi");
    expect(C.languages).toContain(C.defaultLanguage);
  });
});
