import { useEffect, useRef } from "react";
import { create } from "zustand";
import { useSession } from "../stores/session.js";

/** "idle" (no socket yet) | "live" | "reconnecting" — for the portal's live indicator (A-04). */
export const useSocketStatus = create(() => ({ status: "idle" }));
const setStatus = (status) => useSocketStatus.setState({ status });

// Real-time events from the API (docs/02 §7.4). The access token goes in the handshake; when it
// rotates, the socket reconnects with the new one. Handlers live in a local registry so tests can
// dispatch events without a server.

const handlers = new Map(); // event → Set<fn>
let socket = null;
// socket.io-client (~40 KB) is only needed once someone is logged in, so it isn't part of the
// first download (doc 06 task 8.3); it loads the first time a screen subscribes to an event.
let loading = null;
let wantedToken = null; // the token to connect with once the library has loaded; null = logged out

export function dispatchSocketEvent(event, payload) {
  handlers.get(event)?.forEach((fn) => fn(payload));
}

function connect(token) {
  if (import.meta.env.MODE === "test") return;
  wantedToken = token;
  if (!socket) {
    if (!loading)
      loading = import("socket.io-client")
        .then(({ io }) => {
          loading = null;
          if (wantedToken && !socket) open(io, wantedToken);
        })
        .catch(() => {
          loading = null; // e.g. offline before the chunk was cached; the next token change retries
        });
    return;
  }
  socket.auth = { token };
  socket.disconnect().connect();
}

function open(io, token) {
  const url = import.meta.env.VITE_SOCKET_URL || undefined; // same origin in dev (Vite proxy)
  socket = io(url, { auth: { token }, transports: ["websocket", "polling"] });
  socket.onAny((event, payload) => dispatchSocketEvent(event, payload));
  socket.on("connect", () => {
    const wasDown = useSocketStatus.getState().status === "reconnecting";
    setStatus("live");
    // Events may have been missed while offline: let screens refetch (docs/03 A-04).
    if (wasDown) dispatchSocketEvent("socket:reconnected", {});
  });
  socket.on("disconnect", () => setStatus("reconnecting"));
  socket.on("connect_error", (err) => {
    if (err?.message === "TOKEN_EXPIRED") socket.disconnect(); // reconnects after refresh
  });
}

function disconnect() {
  wantedToken = null;
  socket?.disconnect();
  socket = null;
  setStatus("idle");
}

let lastToken = null;
useSession.subscribe((s) => {
  if (s.accessToken === lastToken) return;
  lastToken = s.accessToken;
  if (s.accessToken && handlers.size) connect(s.accessToken);
  if (!s.accessToken) disconnect();
});

/** Subscribes to a server event while the component is mounted. */
export function useSocketEvent(event, handler) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const fn = (payload) => ref.current(payload);
    if (!handlers.has(event)) handlers.set(event, new Set());
    handlers.get(event).add(fn);
    const token = useSession.getState().accessToken;
    if (token && !socket) connect(token);
    return () => handlers.get(event)?.delete(fn);
  }, [event]);
}
