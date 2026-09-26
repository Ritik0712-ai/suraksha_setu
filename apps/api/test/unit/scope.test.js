import { describe, expect, it } from "vitest";
import { Types } from "mongoose";
import { assertInScope, scopeFilter } from "../../src/lib/scope.js";

const village = new Types.ObjectId();
const block = new Types.ObjectId();
const otherVillage = new Types.ObjectId();
const gp = new Types.ObjectId();
const phed = new Types.ObjectId();
const pwd = new Types.ObjectId();

const doc = { jurisdictionAncestors: [village, gp, block], departmentId: phed };
const officer = (jurisdictionIds, departmentId = null) => ({
  role: "authority",
  authority: { jurisdictionIds, departmentId },
});

describe("assertInScope (docs/05 §8)", () => {
  it("lets admins see everything", () => {
    expect(() => assertInScope({ role: "admin" }, doc)).not.toThrow();
  });

  it("allows an officer whose jurisdiction is an ancestor (block covers every village)", () => {
    expect(() => assertInScope(officer([block]), doc)).not.toThrow();
    expect(() => assertInScope(officer([village]), doc)).not.toThrow();
  });

  it("blocks other jurisdictions", () => {
    expect(() => assertInScope(officer([otherVillage]), doc)).toThrow(
      expect.objectContaining({ code: "FORBIDDEN" }),
    );
  });

  it("applies the officer's department for complaints, but not for SOS", () => {
    expect(() => assertInScope(officer([block], phed), doc)).not.toThrow();
    expect(() => assertInScope(officer([block], pwd), doc)).toThrow();
    expect(() =>
      assertInScope(officer([block], pwd), doc, { ignoreDepartment: true }),
    ).not.toThrow();
  });

  it("treats a null department on the officer as all departments", () => {
    expect(() => assertInScope(officer([block], null), doc)).not.toThrow();
  });

  it("never lets citizens through", () => {
    expect(() => assertInScope({ role: "citizen" }, doc)).toThrow();
  });
});

describe("scopeFilter", () => {
  it("builds the same scope into the query", () => {
    expect(scopeFilter({ role: "admin" })).toEqual({});
    expect(scopeFilter(officer([block], phed))).toEqual({
      jurisdictionAncestors: { $in: [block] },
      departmentId: phed,
    });
    expect(scopeFilter(officer([block], phed), { ignoreDepartment: true })).toEqual({
      jurisdictionAncestors: { $in: [block] },
    });
  });
});
