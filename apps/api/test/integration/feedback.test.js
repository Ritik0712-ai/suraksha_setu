import { beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { useTestDb } from "../helpers/db.js";
import { createUser, loginAs, makeApp, seedJurisdictions } from "../helpers/app.js";
import { publishedScheme } from "../helpers/schemes.js";
import { ChatMessage, ChatSession, Feedback } from "../../src/models/index.js";

useTestDb();

let ctx;
let j;
let admin;
let citizen;
let asAdmin;
let asCitizen;
let asOther;
let scheme;
let reply;

beforeEach(async () => {
  j = await seedJurisdictions();
  ctx = makeApp();
  admin = await createUser({
    role: "admin",
    phone: "+919000000001",
    jurisdictionId: j.village._id,
  });
  citizen = await createUser({ phone: "+919876543210", jurisdictionId: j.village._id });
  await createUser({ phone: "+919876543211", jurisdictionId: j.village._id });
  asAdmin = await loginAs(ctx.api, "9000000001");
  asCitizen = await loginAs(ctx.api, "9876543210");
  asOther = await loginAs(ctx.api, "9876543211");
  scheme = await publishedScheme(admin._id);
  const expireAt = new Date(Date.now() + 86400_000);
  const session = await ChatSession.create({
    userId: citizen._id,
    mode: "general",
    title: "x",
    expireAt,
  });
  reply = await ChatMessage.create({
    sessionId: session._id,
    userId: citizen._id,
    role: "assistant",
    text: "जवाब",
    intent: "answer",
    expireAt,
  });
});

const vote = (as, target, targetId, helpful) =>
  as("post", "/feedback").send({ target, targetId: String(targetId), helpful });

describe("👍👎 feedback", () => {
  it("records one vote per person per item; tapping the other thumb changes it", async () => {
    expect((await vote(asCitizen, "scheme", scheme._id, true)).status).toBe(200);
    expect((await vote(asCitizen, "scheme", scheme._id, false)).status).toBe(200);
    const rows = await Feedback.find({ target: "scheme" }).lean();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ helpful: false, jurisdictionId: j.village._id });

    const mine = await asCitizen("get", `/feedback/mine?target=scheme&ids=${scheme._id}`);
    expect(mine.body.data).toEqual({ [String(scheme._id)]: false });
  });

  it("only lets people rate their own Sahayak replies and published schemes", async () => {
    expect((await vote(asCitizen, "sahayak_reply", reply._id, true)).status).toBe(200);
    expect((await vote(asOther, "sahayak_reply", reply._id, true)).status).toBe(404);
    const unknown = new mongoose.Types.ObjectId();
    expect((await vote(asCitizen, "scheme", unknown, true)).status).toBe(404);
    expect((await vote(asCitizen, "nonsense", scheme._id, true)).status).toBe(400);
    const anon = await ctx.api().post("/api/v1/feedback").send({});
    expect(anon.status).toBe(401);
  });

  it("shows admins the totals in analytics (counts only)", async () => {
    await vote(asCitizen, "sahayak_reply", reply._id, true);
    await vote(asCitizen, "scheme", scheme._id, true);
    await vote(asOther, "scheme", scheme._id, false);
    const today = new Date().toISOString().slice(0, 10);
    const res = await asAdmin("get", `/admin/analytics?from=${today}&to=${today}`);
    expect(res.body.data.feedback).toEqual({
      sahayak: { helpful: 1, notHelpful: 0 },
      schemes: [
        { id: String(scheme._id), name: scheme.toObject().name, helpful: 1, notHelpful: 1 },
      ],
    });
  });
});
