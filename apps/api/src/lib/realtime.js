import { Server } from "socket.io";
import { logger } from "./logger.js";
import { verifyAccessToken } from "./tokens.js";
import { loadUser } from "../middleware/auth.js";

// Rooms (docs/02 §7.4, docs/05 §7.6):
//   user:<id>  every logged-in user          → notification:new, sos:acknowledged, sos:updated
//   jur:<id>   authority, per jurisdiction    → sos:new, sos:location, sos:updated, complaint:new
//   admin      admins                         → everything
// Clients never send events in v1: all writes go through REST (one validation path).

const ids = (list) => (list ?? []).map(String);

/** Emitter interface used by services. `createRealtime` and `createRealtimeRecorder` implement it. */
function emitterFor(io) {
  return {
    /** To every officer whose jurisdiction is in the document's ancestors, plus admins. */
    toScope(doc, event, payload) {
      const rooms = [...ids(doc.jurisdictionAncestors).map((id) => `jur:${id}`), "admin"];
      io.to(rooms).emit(event, payload);
    },
    toUser(userId, event, payload) {
      io.to(`user:${userId}`).emit(event, payload);
    },
  };
}

export function createRealtime(httpServer, env) {
  const io = new Server(httpServer, {
    path: "/socket.io",
    cors: { origin: env.CORS_ORIGINS, credentials: true },
    // Long-polling fallback matters on weak rural networks (docs/02 ADR-10).
    transports: ["websocket", "polling"],
  });

  // Handshake auth: same checks as requireAuth (docs/05 §7.4, §7.6).
  io.use(async (socket, next) => {
    try {
      const payload = verifyAccessToken(socket.handshake.auth?.token, env.JWT_ACCESS_SECRET);
      const user = await loadUser(payload.sub);
      if (!user || user.status !== "active" || user.tokenVersion !== payload.ver)
        return next(new Error("UNAUTHENTICATED"));
      socket.data.user = user;
      next();
    } catch (err) {
      next(new Error(err.code ?? "UNAUTHENTICATED"));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.data.user;
    socket.join(`user:${user._id}`);
    if (user.role === "admin") socket.join("admin");
    if (user.role === "authority")
      for (const j of ids(user.authority?.jurisdictionIds)) socket.join(`jur:${j}`);
    logger.debug({ role: user.role }, "socket connected");
  });

  return { io, ...emitterFor(io) };
}

/** In-memory stand-in for tests and scripts: records every emit. */
export function createRealtimeRecorder() {
  const events = [];
  return {
    events,
    toScope(doc, event, payload) {
      events.push({ to: "scope", rooms: ids(doc.jurisdictionAncestors), event, payload });
    },
    toUser(userId, event, payload) {
      events.push({ to: "user", userId: String(userId), event, payload });
    },
  };
}

export const noopRealtime = { toScope() {}, toUser() {} };
