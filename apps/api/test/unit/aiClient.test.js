import { describe, expect, it } from "vitest";
import { createAiClient, parseSuggestion } from "../../src/lib/aiClient.js";
import { testEnv } from "../helpers/app.js";

const env = testEnv({ AI_BASE_URL: "http://ai.internal:8000/", AI_INTERNAL_KEY: "k1" });
const GOOD = {
  category: "road_damage",
  confidence: 0.93,
  top3: [
    { category: "road_damage", confidence: 0.93 },
    { category: "other", confidence: 0.04 },
    { category: "garbage", confidence: 0.02 },
  ],
  modelVersion: "civic_cnn_v1",
  inferenceMs: 151.4,
};
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });

describe("AI client (docs/02 §7.3, §8.2)", () => {
  it("posts the image URL with the internal key and parses the answer", async () => {
    const calls = [];
    const ai = createAiClient({
      env,
      fetchImpl: async (url, init) => {
        calls.push({ url, init });
        return json(GOOD);
      },
    });
    const s = await ai.classify("https://res.cloudinary.com/x.jpg");
    expect(s).toEqual({ ...GOOD, inferenceMs: 151 });
    expect(calls[0].url).toBe("http://ai.internal:8000/internal/classify");
    expect(calls[0].init.headers["X-Internal-Key"]).toBe("k1");
    expect(JSON.parse(calls[0].init.body)).toEqual({
      imageUrl: "https://res.cloudinary.com/x.jpg",
    });
  });

  it("returns null without calling when not configured", async () => {
    let called = false;
    const ai = createAiClient({
      env: testEnv(),
      fetchImpl: async () => {
        called = true;
        return json(GOOD);
      },
    });
    expect(ai.configured).toBe(false);
    expect(await ai.classify("https://x")).toBeNull();
    expect(called).toBe(false);
  });

  it("returns null on 4xx/5xx without retrying", async () => {
    let n = 0;
    const ai = createAiClient({
      env,
      fetchImpl: async () => {
        n += 1;
        return json({ error: { code: "MODEL_UNAVAILABLE" } }, 503);
      },
    });
    expect(await ai.classify("https://x")).toBeNull();
    expect(n).toBe(1);
  });

  it("retries once after a quick connection failure", async () => {
    let n = 0;
    const ai = createAiClient({
      env,
      fetchImpl: async () => {
        n += 1;
        if (n === 1) throw new TypeError("fetch failed: ECONNRESET");
        return json(GOOD);
      },
    });
    expect((await ai.classify("https://x")).category).toBe("road_damage");
    expect(n).toBe(2);
  });

  it("gives up at the timeout and doesn't retry", async () => {
    let n = 0;
    const ai = createAiClient({
      env,
      timeoutMs: 50,
      fetchImpl: (_url, init) => {
        n += 1;
        return new Promise((_resolve, reject) => {
          init.signal.addEventListener("abort", () => reject(init.signal.reason));
        });
      },
    });
    const started = Date.now();
    expect(await ai.classify("https://x")).toBeNull();
    expect(Date.now() - started).toBeLessThan(1000);
    expect(n).toBe(1);
  });

  it("health reports up/down and never throws", async () => {
    const up = createAiClient({ env, fetchImpl: async () => json({ modelVersion: "v1" }) });
    expect(await up.health()).toEqual({ ok: true, modelVersion: "v1" });
    const down = createAiClient({
      env,
      fetchImpl: async () => {
        throw new Error("down");
      },
    });
    expect(await down.health()).toEqual({ ok: false, modelVersion: null });
  });
});

describe("parseSuggestion", () => {
  it("rejects malformed answers", () => {
    expect(parseSuggestion(null)).toBeNull();
    expect(parseSuggestion({ ...GOOD, category: "potholes" })).toBeNull();
    expect(parseSuggestion({ ...GOOD, confidence: 1.4 })).toBeNull();
    expect(parseSuggestion({ ...GOOD, modelVersion: "" })).toBeNull();
  });

  it("keeps only valid top3 entries, at most 3", () => {
    const s = parseSuggestion({
      ...GOOD,
      top3: [...GOOD.top3, { category: "streetlight", confidence: 0.01 }, { category: "x" }],
    });
    expect(s.top3).toHaveLength(3);
  });
});
