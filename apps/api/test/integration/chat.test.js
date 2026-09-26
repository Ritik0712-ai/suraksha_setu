import { beforeEach, describe, expect, it } from "vitest";
import { useTestDb } from "../helpers/db.js";
import { createUser, loginAs, makeApp, seedJurisdictions } from "../helpers/app.js";
import { publishedScheme } from "../helpers/schemes.js";
import { ChatMessage, ChatSession, UsageEvent } from "../../src/models/index.js";

useTestDb();

let ctx;
let j;
let me;
let asMe;

beforeEach(async () => {
  j = await seedJurisdictions();
  ctx = makeApp();
  me = await createUser({
    name: "Ramesh Kumar",
    phone: "+919876543210",
    jurisdictionId: j.village._id,
  });
  asMe = await loginAs(ctx.api, "9876543210");
});

const start = (body = { mode: "general" }) => asMe("post", "/chat/sessions").send(body);
const say = (id, text, extra = {}) =>
  asMe("post", `/chat/sessions/${id}/messages`).send({ text, ...extra });

describe("Sahayak sessions (docs/02 §7.2 M7, docs/05 §5.14)", () => {
  it("general session: title comes from the first message; list and read back", async () => {
    const s = await start();
    expect(s.status).toBe(201);
    expect(s.body.data).toMatchObject({ mode: "general", title: "नई बातचीत", messages: [] });
    expect(s.body.data.remainingToday).toBe(30);

    const r = await say(s.body.data.id, "PM kisan ke bare mein batao");
    expect(r.status).toBe(200);
    expect(r.body.data.reply).toMatchObject({
      role: "assistant",
      intent: "answer",
      text: "ठीक है",
    });
    expect(r.body.data.remainingToday).toBe(29);
    expect(r.body.data.session.title).toBe("PM kisan ke bare mein batao");

    const list = await asMe("get", "/chat/sessions");
    expect(list.body.data).toHaveLength(1);
    const got = await asMe("get", `/chat/sessions/${s.body.data.id}`);
    expect(got.body.data.messages.map((m) => m.role)).toEqual(["user", "assistant"]);
  });

  it("sends language, mode, place and the last 10 turns to the AI service", async () => {
    const s = await start();
    const id = s.body.data.id;
    for (let i = 0; i < 7; i += 1) await say(id, `sawal ${i}`);
    await asMe("post", `/chat/sessions/${id}/messages`)
      .set("Accept-Language", "en")
      .send({ text: "last one" });
    const call = ctx.ai.sahayakCalls.at(-1);
    expect(call).toMatchObject({ language: "en", mode: "general", message: "last one" });
    expect(call.history).toHaveLength(10);
    expect(call.history.at(-1)).toEqual({ role: "assistant", text: "ठीक है" });
    expect(call.userContext).toEqual({
      village: "Mahodiya",
      gp: "Mahodiya",
      block: "Sehore",
      district: "Sehore",
    });
    expect(JSON.stringify(call)).not.toContain("9876543210"); // phone never goes to the LLM
  });

  it("letter session opens with the first question; letter gets date, place and phone", async () => {
    const s = await start({ mode: "letter", letterType: "panchayat_complaint" });
    expect(s.body.data.title).toBe("पंचायत को पत्र");
    expect(s.body.data.messages[0]).toMatchObject({ intent: "need_info", chips: ["Ramesh Kumar"] });

    ctx.ai.sahayak = {
      ok: true,
      reply: {
        intent: "letter_ready",
        text: "आपका पत्र तैयार है।",
        cards: [],
        chips: [],
        letter: {
          to: "श्रीमान सरपंच/सचिव महोदय",
          subject: "हैंडपंप की मरम्मत हेतु आवेदन",
          body: "निवेदन है कि ...",
          applicantName: "रमेश कुमार",
          includeMobile: true,
        },
        llm: { provider: "fake", model: "f", tokensIn: 10, tokensOut: 5, latencyMs: 3 },
      },
    };
    const r = await say(s.body.data.id, "हाँ, नंबर डाल दो");
    expect(ctx.ai.sahayakCalls.at(-1)).toMatchObject({
      mode: "letter",
      letterType: "panchayat_complaint",
    });
    expect(r.body.data.reply.letter).toMatchObject({
      applicantName: "रमेश कुमार",
      place: "महोदिया",
      mobile: "9876543210",
    });
    expect(r.body.data.reply.letter.date).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    const stored = await ChatMessage.findById(r.body.data.reply.id).lean();
    expect(stored.llm).toMatchObject({ provider: "fake", tokensIn: 10 });
    await new Promise((ok) => setTimeout(ok, 50));
    expect(await UsageEvent.countDocuments({ type: "letter_generated" })).toBe(1);

    // S-26 edit keeps the draft and stores the user's version
    const edit = await asMe(
      "put",
      `/chat/sessions/${s.body.data.id}/messages/${r.body.data.reply.id}/letter`,
    ).send({
      to: "श्रीमान सचिव महोदय",
      subject: "हैंडपंप",
      body: "नया पाठ",
      place: "महोदिया",
      date: "27/09/2026",
      applicantName: "रमेश कुमार",
    });
    expect(edit.status).toBe(200);
    expect(edit.body.data.letter.body).toBe("निवेदन है कि ...");
    expect(edit.body.data.letterEdited.body).toBe("नया पाठ");

    // editing a message without a letter → 404
    const opener = s.body.data.messages[0].id;
    const bad = await asMe(
      "put",
      `/chat/sessions/${s.body.data.id}/messages/${opener}/letter`,
    ).send({
      to: "a",
      subject: "b",
      body: "c",
      applicantName: "d",
    });
    expect(bad.status).toBe(404);
  });

  it("scheme_help needs a published scheme and pins it; cards resolve to published schemes", async () => {
    const admin = await createUser({
      role: "admin",
      phone: "+919000000001",
      jurisdictionId: j.village._id,
    });
    const scheme = await publishedScheme(admin._id);
    const bad = await start({ mode: "scheme_help", schemeId: "0123456789abcdef01234567" });
    expect(bad.status).toBe(404);

    const s = await start({ mode: "scheme_help", schemeId: String(scheme._id) });
    expect(s.status).toBe(201);
    expect(s.body.data.messages[0].chips).toHaveLength(3);

    ctx.ai.sahayak = {
      ok: true,
      reply: {
        intent: "answer",
        text: "देखिए",
        cards: [scheme.slug, "not-published"],
        chips: [],
        letter: null,
        llm: {},
      },
    };
    const r = await say(s.body.data.id, "कौन आवेदन कर सकता है?");
    expect(ctx.ai.sahayakCalls.at(-1).schemeIds).toEqual([String(scheme._id)]);
    expect(r.body.data.reply.cards).toHaveLength(1);
    expect(r.body.data.reply.cards[0]).toMatchObject({
      slug: scheme.slug,
      name: { hi: scheme.name.hi, en: scheme.name.en },
      benefitShort: { en: scheme.benefitShort.en },
    });
  });

  it("validates input", async () => {
    expect((await start({ mode: "letter" })).status).toBe(400);
    expect((await start({ mode: "scheme_help" })).status).toBe(400);
    expect((await start({ mode: "chat" })).status).toBe(400);
    const s = await start();
    expect((await say(s.body.data.id, "x".repeat(1001))).status).toBe(400);
    expect((await say(s.body.data.id, "   ")).status).toBe(400);
  });
});

describe("Sahayak safety and limits (docs/02 §4.4, SEC-06, SEC-16)", () => {
  it("emergency words return the SOS card without calling the LLM", async () => {
    const s = await start();
    const r = await say(s.body.data.id, "बचाओ! कोई पीछा कर रहा है");
    expect(r.status).toBe(200);
    expect(r.body.data.reply).toMatchObject({ role: "notice", intent: "emergency" });
    expect(ctx.ai.sahayakCalls).toHaveLength(0);

    // "No, I'm not in danger" resends with the check skipped
    const again = await say(s.body.data.id, "accident insurance yojana", {
      skipEmergencyCheck: true,
    });
    expect(again.body.data.reply.intent).toBe("answer");
    expect(ctx.ai.sahayakCalls).toHaveLength(1);
    // notices are not sent to the LLM as conversation
    expect(ctx.ai.sahayakCalls[0].history.map((h) => h.role)).toEqual(["user"]);
  });

  it("30 messages per day; the emergency card still works after the limit", async () => {
    const s = await start();
    const docs = Array.from({ length: 30 }, (_, i) => ({
      sessionId: s.body.data.id,
      userId: me._id,
      role: "user",
      text: `m${i}`,
      expireAt: new Date(Date.now() + 86400_000),
    }));
    await ChatMessage.insertMany(docs);
    const r = await say(s.body.data.id, "PM kisan");
    expect(r.status).toBe(429);
    expect(r.body.error.message).toContain("सीमा");
    const sos = await say(s.body.data.id, "bachao");
    expect(sos.status).toBe(200);
    expect(sos.body.data.reply.intent).toBe("emergency");
  });

  it("AI down: 503 with the reason, and nothing is stored (retry won't duplicate)", async () => {
    const s = await start();
    ctx.ai.sahayak = { ok: false, reason: "failed" };
    const r = await say(s.body.data.id, "PM kisan");
    expect(r.status).toBe(503);
    expect(r.body.error).toMatchObject({ code: "AI_UNAVAILABLE", message: "जवाब नहीं आ सका।" });
    expect(r.body.error.details).toEqual([{ field: "reason", issue: "failed" }]);
    ctx.ai.sahayak = { ok: false, reason: "resting" };
    const rest = await asMe("post", `/chat/sessions/${s.body.data.id}/messages`)
      .set("Accept-Language", "en")
      .send({ text: "PM kisan" });
    expect(rest.body.error.message).toBe(
      "Sahayak is resting right now. You can still browse schemes.",
    );
    expect(await ChatMessage.countDocuments({ sessionId: s.body.data.id })).toBe(0);
  });

  it("sessions are private: another citizen gets 404; authority gets 403; delete removes messages", async () => {
    const s = await start();
    await say(s.body.data.id, "hello");
    await createUser({ name: "Other", phone: "+919876500000", jurisdictionId: j.village._id });
    const asOther = await loginAs(ctx.api, "9876500000");
    expect((await asOther("get", `/chat/sessions/${s.body.data.id}`)).status).toBe(404);
    expect(
      (await asOther("post", `/chat/sessions/${s.body.data.id}/messages`).send({ text: "hi" }))
        .status,
    ).toBe(404);
    expect((await asOther("delete", `/chat/sessions/${s.body.data.id}`)).status).toBe(404);

    await createUser({
      role: "authority",
      phone: "+919811111111",
      jurisdictionId: j.village._id,
      authority: { jurisdictionIds: [j.village._id] },
    });
    const asOfficer = await loginAs(ctx.api, "9811111111");
    expect((await asOfficer("get", "/chat/sessions")).status).toBe(403);

    expect((await asMe("delete", `/chat/sessions/${s.body.data.id}`)).status).toBe(200);
    expect(await ChatSession.countDocuments()).toBe(0);
    expect(await ChatMessage.countDocuments()).toBe(0);
  });

  it("unauthenticated → 401", async () => {
    expect((await ctx.api().get("/api/v1/chat/sessions")).status).toBe(401);
  });
});
