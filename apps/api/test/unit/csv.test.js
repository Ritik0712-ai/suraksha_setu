import { describe, expect, it } from "vitest";
import { parseCsv, parseCsvObjects, toCsv } from "../../src/lib/csv.js";

describe("CSV helpers", () => {
  it("parses quotes, escaped quotes, commas, CRLF and a BOM", () => {
    expect(parseCsv('\uFEFFa,b\r\n"x, y","say ""hi"""\n\n')).toEqual([
      ["a", "b"],
      ["x, y", 'say "hi"'],
    ]);
    expect(parseCsvObjects(" Name ,Type\nA,hospital")).toEqual([{ name: "A", type: "hospital" }]);
  });

  it("writes CSV with a BOM and neutralises formulas", () => {
    const out = toCsv([
      ["no", "note"],
      ["SS-1", "=HYPERLINK(evil)"],
      ["SS-2", 'a "b", c'],
    ]);
    expect(out.startsWith("\uFEFF")).toBe(true);
    expect(out).toContain("'=HYPERLINK(evil)");
    expect(out).toContain('"a ""b"", c"');
  });
});
