import { describe, expect, it } from "vitest";
import { createMailer } from "../../src/lib/mailer.js";
import { createPlacesBudget } from "../../src/modules/emergency/places.js";
import { createStorage } from "../../src/lib/storage.js";
import { testEnv } from "../helpers/app.js";

// docs/06 Phase 5 — integration behaviour that doesn't need the real services.

function fakeTransports(behaviour) {
  const made = [];
  const createTransport = (opts) => {
    const t = {
      opts,
      sent: [],
      async sendMail(msg) {
        if (behaviour[opts.host] === "fail") throw new Error("SMTP 421");
        t.sent.push(msg);
      },
    };
    made.push(t);
    return t;
  };
  return { made, createTransport };
}

const smtp = {
  SMTP_HOST: "smtp.gmail.com",
  SMTP_PORT: "587",
  SMTP_USER: "team@gmail.com",
  SMTP_PASS: "app-pass",
  MAIL_FROM: "Suraksha Setu <team@gmail.com>",
};
const brevo = {
  SMTP_FALLBACK_HOST: "smtp-relay.brevo.com",
  SMTP_FALLBACK_USER: "brevo-user",
  SMTP_FALLBACK_PASS: "brevo-key",
};

describe("SMTP with a Brevo fallback (task 5.3)", () => {
  it("uses the primary when it works", async () => {
    const t = fakeTransports({});
    const m = createMailer(testEnv({ ...smtp, ...brevo }), t);
    expect(m.servers).toEqual(["primary", "fallback"]);
    expect(await m.send("a@x.in", "SOS", "help")).toBe(true);
    expect(t.made[0].sent).toHaveLength(1);
    expect(t.made[1].sent).toHaveLength(0);
    expect(t.made[0].opts).toMatchObject({ host: "smtp.gmail.com", port: 587, secure: false });
  });

  it("falls back when the primary fails, and reports failure when both fail", async () => {
    const t = fakeTransports({ "smtp.gmail.com": "fail" });
    const m = createMailer(testEnv({ ...smtp, ...brevo }), t);
    expect(await m.send("a@x.in", "SOS", "help")).toBe(true);
    expect(t.made[1].sent[0]).toMatchObject({ to: "a@x.in", from: smtp.MAIL_FROM });

    const both = fakeTransports({ "smtp.gmail.com": "fail", "smtp-relay.brevo.com": "fail" });
    const m2 = createMailer(testEnv({ ...smtp, ...brevo }), both);
    expect(await m2.send("a@x.in", "SOS", "help")).toBe(false);
  });

  it("works with only the fallback, and logs-and-drops with neither", async () => {
    const t = fakeTransports({});
    expect(createMailer(testEnv(brevo), t).servers).toEqual(["fallback"]);
    const none = createMailer(testEnv(), fakeTransports({}));
    expect(none.configured).toBe(false);
    expect(await none.send("a@x.in", "s", "t")).toBe(false);
  });
});

describe("Places daily budget (task 5.2)", () => {
  it("stops at the limit and resets at IST midnight", () => {
    let now = new Date("2026-09-27T10:00:00Z");
    const b = createPlacesBudget(2, () => now);
    expect([b.take(), b.take(), b.take()]).toEqual([true, true, false]);
    now = new Date("2026-09-27T18:29:00Z"); // 23:59 IST, same day
    expect(b.take()).toBe(false);
    now = new Date("2026-09-27T18:31:00Z"); // 00:01 IST, next day
    expect(b.take()).toBe(true);
    expect(createPlacesBudget(0).take()).toBe(false);
  });
});

describe("Cloudinary folders per environment (task 5.1)", () => {
  it("uses APP_ENV when set, else NODE_ENV", async () => {
    const calls = [];
    const fetchImpl = async (url, init) => {
      calls.push(init.body);
      return new Response(
        JSON.stringify({
          secure_url: "https://res.cloudinary.com/x.jpg",
          public_id: "p",
          bytes: 1,
        }),
      );
    };
    const url = "cloudinary://key:secret@demo";
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    await createStorage(testEnv({ CLOUDINARY_URL: url, APP_ENV: "preview" }), { fetchImpl }).upload(
      jpeg,
      { folder: "complaints", mime: "image/jpeg" },
    );
    await createStorage(testEnv({ CLOUDINARY_URL: url }), { fetchImpl }).upload(jpeg, {
      folder: "complaints",
      mime: "image/jpeg",
    });
    expect(calls[0].get("folder")).toBe("suraksha/preview/complaints");
    expect(calls[1].get("folder")).toBe("suraksha/test/complaints");
  });
});
