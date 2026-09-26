import { describe, expect, it } from "vitest";
import C from "../../src/config/constants.js";
import { isEmergencyMessage, normalizeForCheck } from "../../../../shared/emergencyCheck.js";
import { createAiClient, parseSahayakReply } from "../../src/lib/aiClient.js";
import { istDate } from "../../src/modules/chat/routes.js";
import { testEnv } from "../helpers/app.js";

const check = (t) => isEmergencyMessage(t, C.sahayak);

describe("Sahayak emergency pre-check (docs/02 §4.4, 4G.3)", () => {
  it.each([
    "बचाओ",
    "bachao!!",
    "Bachaoooo koi hai",
    "कोई मुझे मार रहा है",
    "mera pati mujhe maar raha hai",
    "someone is following me home",
    "there was an accident near the school",
    "गाँव में आग लग गई",
    "वह बेहोश हो गई है",
    "मैं ख़तरे में हूँ", // nukta spelling
    "HELP",
    "help me",
    "please help!!",
    "madad",
    "मदद करो",
    "police bulao",
  ])("flags %s", (t) => expect(check(t)).toBe(true));

  it.each([
    "मुझे पत्र लिखने में मदद चाहिए, पंचायत को हैंडपंप के बारे में",
    "help me write a letter to the BDO please",
    "Ayushman card kaise banega?",
    "PM kisan ki kist kab aayegi",
    "fire brigade ka number kya hai aur complaint kaise karein",
    "",
    "   ",
  ])("does not flag %s", (t) => expect(check(t)).toBe(false));

  it("normalises punctuation, case and nukta", () => {
    expect(normalizeForCheck("  ख़तरा!! HELP.")).toBe(" खतरा help ");
    expect(normalizeForCheck(null)).toBe("");
  });

  it("every keyword is itself detected", () => {
    for (const k of C.sahayak.emergencyKeywords.strong) expect(check(k)).toBe(true);
    for (const k of C.sahayak.emergencyKeywords.weak) expect(check(k)).toBe(true);
  });
});

describe("Sahayak AI client (docs/02 §7.3)", () => {
  const env = testEnv({ AI_BASE_URL: "http://ai.internal:8000", AI_INTERNAL_KEY: "k1" });
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
  const GOOD = {
    intent: "answer",
    text: "PM-KISAN में ...",
    cards: ["pm-kisan"],
    chips: ["x"],
    llm: { provider: "gemini", model: "m", tokensIn: 100.2, tokensOut: 20, latencyMs: 900 },
  };

  it("posts with the internal key and parses a good answer", async () => {
    const calls = [];
    const ai = createAiClient({
      env,
      fetchImpl: async (url, init) => {
        calls.push({ url, init });
        return json(GOOD);
      },
    });
    const out = await ai.sahayakReply({ language: "hi", mode: "general", message: "hi" });
    expect(calls[0].url).toBe("http://ai.internal:8000/internal/sahayak/reply");
    expect(calls[0].init.headers["X-Internal-Key"]).toBe("k1");
    expect(out.ok).toBe(true);
    expect(out.reply).toMatchObject({ intent: "answer", cards: ["pm-kisan"], chips: [] });
    expect(out.reply.llm.tokensIn).toBe(100);
  });

  it("maps failures to resting / failed without throwing", async () => {
    const unconfigured = createAiClient({ env: testEnv() });
    expect(await unconfigured.sahayakReply({})).toEqual({ ok: false, reason: "resting" });

    const notConfigured = createAiClient({
      env,
      fetchImpl: async () => json({ error: { code: "LLM_NOT_CONFIGURED" } }, 503),
    });
    expect((await notConfigured.sahayakReply({})).reason).toBe("resting");

    const down = createAiClient({
      env,
      fetchImpl: async () => json({ error: { code: "LLM_UNAVAILABLE" } }, 503),
    });
    expect((await down.sahayakReply({})).reason).toBe("failed");

    const broken = createAiClient({ env, fetchImpl: async () => json({ intent: "dance" }) });
    expect((await broken.sahayakReply({})).reason).toBe("failed");

    const slow = createAiClient({
      env,
      sahayakTimeoutMs: 20,
      fetchImpl: (_u, init) =>
        new Promise((_r, reject) =>
          init.signal.addEventListener("abort", () => reject(init.signal.reason)),
        ),
    });
    expect((await slow.sahayakReply({})).reason).toBe("failed");
  });

  it("only accepts complete letters", () => {
    const base = { intent: "letter_ready", text: "तैयार" };
    expect(parseSahayakReply({ ...base, letter: { to: "a" } })).toBeNull();
    const l = { to: "a", subject: "b", body: "c", applicantName: "d", includeMobile: "yes" };
    expect(parseSahayakReply({ ...base, letter: l }).letter.includeMobile).toBe(false);
  });

  it("formats the letter date in IST", () => {
    expect(istDate(new Date("2026-09-26T20:00:00Z"))).toBe("27/09/2026");
  });
});

describe("Sahayak evaluation set (docs/06 4G.7)", () => {
  it("the keyword pre-check catches 100% of the emergency questions", async () => {
    const { readFile } = await import("node:fs/promises");
    const set = JSON.parse(
      await readFile(new URL("../../../ai/eval/sahayak_eval_set.json", import.meta.url), "utf8"),
    );
    const emergencies = set.items.filter((i) => i.expect.localEmergency);
    expect(emergencies.length).toBeGreaterThanOrEqual(5);
    for (const i of emergencies) expect(check(i.message), i.id).toBe(true);
    // …and doesn't fire on the ordinary scheme and letter questions
    const ordinary = set.items.filter((i) => i.category !== "tricky");
    const falseAlarms = ordinary.filter((i) => check(i.message)).map((i) => i.id);
    expect(falseAlarms).toEqual([]);
  });
});
