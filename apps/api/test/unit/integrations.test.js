import { describe, expect, it } from "vitest";
import { createMailer, parseFrom } from "../../src/lib/mailer.js";
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
        if (behaviour[opts.tls?.servername ?? opts.host] === "fail") throw new Error("SMTP 421");
        t.sent.push(msg);
      },
    };
    made.push(t);
    return t;
  };
  // IPv4 lookups: Gmail resolves, Brevo's lookup fails (then the host name is used as is).
  const resolve4 = async (host) => {
    if (host === "smtp.gmail.com") return ["142.250.4.109"];
    throw new Error("ENOTFOUND");
  };
  return { made, createTransport, resolve4 };
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
    expect(t.made).toHaveLength(1); // the fallback is never contacted
    // Connects to the IPv4 address (Render has no IPv6 route) but checks TLS for the real name.
    expect(t.made[0].opts).toMatchObject({
      host: "142.250.4.109",
      port: 587,
      secure: false,
      tls: { servername: "smtp.gmail.com" },
    });
  });

  it("uses the host name when there is no IPv4 record", async () => {
    const t = fakeTransports({ "smtp.gmail.com": "fail" });
    const m = createMailer(testEnv({ ...smtp, ...brevo }), t);
    expect(await m.send("a@x.in", "SOS", "help")).toBe(true);
    expect(t.made[1].opts).toMatchObject({
      host: "smtp-relay.brevo.com",
      tls: { servername: "smtp-relay.brevo.com" },
    });
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

describe("Brevo HTTPS API first (Render's free plan blocks SMTP ports)", () => {
  const brevoKey = { BREVO_API_KEY: "xkeysib-test" };
  const fakeFetch = (status) => {
    const calls = [];
    const fetchImpl = async (url, init) => {
      calls.push({ url, init, body: JSON.parse(init.body) });
      return new Response(status === 201 ? '{"messageId":"m1"}' : '{"code":"unauthorized"}', {
        status,
      });
    };
    return { calls, fetchImpl };
  };

  it("sends through the API when BREVO_API_KEY is set, never touching SMTP", async () => {
    const t = fakeTransports({});
    const f = fakeFetch(201);
    const m = createMailer(testEnv({ ...smtp, ...brevoKey }), { ...t, fetchImpl: f.fetchImpl });
    expect(m.servers).toEqual(["brevo-api", "primary"]);
    expect(await m.send("a@x.in", "SOS", "help")).toBe(true);
    expect(f.calls[0].url).toBe("https://api.brevo.com/v3/smtp/email");
    expect(f.calls[0].init.headers["api-key"]).toBe("xkeysib-test");
    expect(f.calls[0].body).toEqual({
      sender: parseFrom(smtp.MAIL_FROM),
      to: [{ email: "a@x.in" }],
      subject: "SOS",
      textContent: "help",
    });
    expect(t.made).toHaveLength(0);
  });

  it("falls back to SMTP when the API refuses", async () => {
    const t = fakeTransports({});
    const f = fakeFetch(401);
    const m = createMailer(testEnv({ ...smtp, ...brevoKey }), { ...t, fetchImpl: f.fetchImpl });
    expect(await m.send("a@x.in", "SOS", "help")).toBe(true);
    expect(t.made[0].sent).toHaveLength(1);
  });

  it("parses the sender", () => {
    expect(parseFrom("Suraksha Setu <a@b.in>")).toEqual({ name: "Suraksha Setu", email: "a@b.in" });
    expect(parseFrom('"Team" <t@x.in>')).toEqual({ name: "Team", email: "t@x.in" });
    expect(parseFrom("plain@x.in")).toEqual({ email: "plain@x.in" });
  });
});

describe("Free Gmail relay (Apps Script) first — no domain, HTTPS only", () => {
  const relay = {
    MAIL_RELAY_URL: "https://script.google.com/macros/s/abc/exec",
    MAIL_RELAY_SECRET: "a-long-shared-secret-of-32-chars!",
  };
  const relayFetch = (replies) => {
    const calls = [];
    const fetchImpl = async (url, init) => {
      calls.push({ url, init, body: JSON.parse(init.body) });
      const r = replies[url.includes("brevo") ? "brevo" : "relay"];
      return new Response(r.body, { status: r.status });
    };
    return { calls, fetchImpl };
  };

  it("sends through the relay, before Brevo and SMTP", async () => {
    const t = fakeTransports({});
    const f = relayFetch({ relay: { status: 200, body: '{"ok":true}' } });
    const m = createMailer(testEnv({ ...smtp, ...relay, BREVO_API_KEY: "xkeysib-test" }), {
      ...t,
      fetchImpl: f.fetchImpl,
    });
    expect(m.servers).toEqual(["gmail-relay", "brevo-api", "primary"]);
    expect(await m.send("a@x.in", "SOS", "help")).toBe(true);
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0].url).toBe(relay.MAIL_RELAY_URL);
    expect(f.calls[0].init.redirect).toBe("follow");
    expect(f.calls[0].body).toEqual({
      secret: relay.MAIL_RELAY_SECRET,
      to: "a@x.in",
      subject: "SOS",
      text: "help",
    });
    expect(t.made).toHaveLength(0);
  });

  it("treats a 200 with ok:false (Apps Script errors) as a failure and falls back", async () => {
    const t = fakeTransports({});
    const f = relayFetch({
      relay: { status: 200, body: '{"ok":false,"error":"quota"}' },
      brevo: { status: 201, body: '{"messageId":"m1"}' },
    });
    const m = createMailer(testEnv({ ...relay, BREVO_API_KEY: "xkeysib-test" }), {
      ...t,
      fetchImpl: f.fetchImpl,
    });
    expect(await m.send("a@x.in", "SOS", "help")).toBe(true);
    expect(f.calls.map((c) => c.url)).toEqual([
      relay.MAIL_RELAY_URL,
      "https://api.brevo.com/v3/smtp/email",
    ]);
  });

  it("fails cleanly on a non-JSON reply, and needs both settings", async () => {
    const f = relayFetch({ relay: { status: 200, body: "<html>login</html>" } });
    const m = createMailer(testEnv(relay), { ...fakeTransports({}), fetchImpl: f.fetchImpl });
    expect(await m.send("a@x.in", "SOS", "help")).toBe(false);
    const half = createMailer(
      testEnv({ MAIL_RELAY_URL: relay.MAIL_RELAY_URL }),
      fakeTransports({}),
    );
    expect(half.configured).toBe(false);
  });

  it("rejects an http URL or a short secret at start-up", () => {
    expect(() => testEnv({ ...relay, MAIL_RELAY_URL: "http://x.in/exec" })).toThrow(/https/);
    expect(() => testEnv({ ...relay, MAIL_RELAY_SECRET: "short" })).toThrow(/24/);
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
