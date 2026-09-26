import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createServer } from "node:http";
import mongoose from "mongoose";
import request from "supertest";
import { io as connect } from "socket.io-client";
import { useTestDb } from "../helpers/db.js";
import { createUser, loginAs, seedJurisdictions, testEnv } from "../helpers/app.js";
import { createApp } from "../../src/app.js";
import { createRealtime } from "../../src/lib/realtime.js";
import { signAccessToken } from "../../src/lib/tokens.js";
import { User } from "../../src/models/User.js";

useTestDb();

// A real HTTP server + Socket.IO, wired the same way as src/server.js.
let server;
let url;
let sockets = [];
const env = testEnv();

beforeEach(async () => {
  let io = null;
  const realtime = { toScope: (...a) => io?.toScope(...a), toUser: (...a) => io?.toUser(...a) };
  server = createServer(
    createApp({ env, realtime, mailer: { send: async () => true }, rateLimits: false }),
  );
  io = createRealtime(server, env);
  await new Promise((r) => server.listen(0, r));
  url = `http://127.0.0.1:${server.address().port}`;
});

afterEach(async () => {
  sockets.forEach((s) => s.close());
  sockets = [];
  await new Promise((r) => server.close(r));
});

function socketFor(user) {
  const s = connect(url, {
    auth: { token: signAccessToken(user, env.JWT_ACCESS_SECRET) },
    transports: ["websocket"],
    reconnection: false,
  });
  sockets.push(s);
  return s;
}
const once = (s, event) => new Promise((resolve) => s.once(event, resolve));

describe("Socket.IO (docs/02 §7.4, docs/05 §7.6)", () => {
  it("rejects a handshake without a valid token", async () => {
    const s = connect(url, {
      auth: { token: "nope" },
      transports: ["websocket"],
      reconnection: false,
    });
    sockets.push(s);
    const err = await once(s, "connect_error");
    expect(err.message).toBe("UNAUTHENTICATED");
  });

  it("delivers sos:new to officers in scope within moments, and not to others", async () => {
    const j = await seedJurisdictions();
    const officer = await createUser({
      role: "authority",
      phone: "+919000000002",
      jurisdictionId: j.village._id,
      authority: { jurisdictionIds: [j.block._id] },
    });
    const other = await createUser({
      role: "authority",
      phone: "+919000000003",
      jurisdictionId: j.village._id,
      authority: { jurisdictionIds: [new mongoose.Types.ObjectId()] },
    });
    await createUser({ phone: "+919876543210", jurisdictionId: j.village._id });

    const inScope = socketFor(officer);
    const outOfScope = socketFor(other);
    await Promise.all([once(inScope, "connect"), once(outOfScope, "connect")]);
    let leaked = false;
    outOfScope.on("sos:new", () => (leaked = true));

    const as = await loginAs(() => request(url), "9876543210");
    const started = Date.now();
    const got = once(inScope, "sos:new");
    await as("post", "/sos").send({ lat: 23.2005, lng: 77.0805, accuracyM: 10, source: "gps" });
    const payload = await got;
    expect(Date.now() - started).toBeLessThan(5000); // docs/01 US-04 AC3: pin within 5 s
    expect(payload).toMatchObject({ status: "ACTIVE", user: { name: "citizen user" } });
    await new Promise((r) => setTimeout(r, 200));
    expect(leaked).toBe(false);
  });

  it("closes the door on revoked tokens (tokenVersion)", async () => {
    const j = await seedJurisdictions();
    const u = await createUser({ phone: "+919876543210", jurisdictionId: j.village._id });
    const token = signAccessToken(u, env.JWT_ACCESS_SECRET);
    await User.updateOne({ _id: u._id }, { $inc: { tokenVersion: 1 } });
    const { invalidateUser } = await import("../../src/middleware/auth.js");
    invalidateUser(u._id);
    const s = connect(url, { auth: { token }, transports: ["websocket"], reconnection: false });
    sockets.push(s);
    expect((await once(s, "connect_error")).message).toBe("UNAUTHENTICATED");
  });
});
