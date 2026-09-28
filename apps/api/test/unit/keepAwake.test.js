import { describe, expect, it } from "vitest";
import { isDaytime, istMinutes, keepAwakeTick } from "../../src/jobs/keepAwake.js";

// Free-plan keep-awake (docs/runbook.md §2.4): pings its own URL only in the IST daytime.
describe("keep-awake self ping", () => {
  const at = (iso) => new Date(iso);

  it("converts to IST minutes", () => {
    expect(istMinutes(at("2026-09-28T00:00:00Z"))).toBe(330); // 05:30 IST
    expect(istMinutes(at("2026-09-28T18:30:00Z"))).toBe(0); // midnight IST
  });

  it("is daytime from 06:30 to 23:10 IST", () => {
    expect(isDaytime(at("2026-09-28T00:59:00Z"))).toBe(false); // 06:29
    expect(isDaytime(at("2026-09-28T01:00:00Z"))).toBe(true); // 06:30
    expect(isDaytime(at("2026-09-28T17:39:00Z"))).toBe(true); // 23:09
    expect(isDaytime(at("2026-09-28T17:40:00Z"))).toBe(false); // 23:10
  });

  it("pings /api/v1/health on its public URL in the daytime only, and never throws", async () => {
    const urls = [];
    const fetchImpl = async (url) => {
      urls.push(url);
      return { ok: true };
    };
    const publicUrl = "https://api.example.onrender.com/";
    expect(await keepAwakeTick({ publicUrl, fetchImpl, now: at("2026-09-28T08:00:00Z") })).toBe(
      true,
    );
    expect(urls).toEqual(["https://api.example.onrender.com/api/v1/health"]);
    expect(await keepAwakeTick({ publicUrl, fetchImpl, now: at("2026-09-28T20:00:00Z") })).toBe(
      false,
    );
    expect(await keepAwakeTick({ publicUrl: undefined, fetchImpl })).toBe(false);
    const failing = async () => {
      throw new Error("ECONNRESET");
    };
    expect(
      await keepAwakeTick({ publicUrl, fetchImpl: failing, now: at("2026-09-28T08:00:00Z") }),
    ).toBe(false);
    expect(urls).toHaveLength(1);
  });
});
