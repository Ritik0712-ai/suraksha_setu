import { create } from "zustand";
import { apiError } from "../api/client.js";

// Complaints saved on the phone when the network dropped, sent automatically once it is back
// (the village often has one bar of 2G). Kept in IndexedDB so a photo survives closing the app;
// if IndexedDB is unavailable (private mode) they live in memory until the tab closes.
//
// Each item belongs to the person who filed it: on a shared phone only that person's session
// sends it, and others never see it.

const DB = "ss_outbox";
const STORE = "complaints";
// Server keeps an unattached photo ~23 h (api jobs/uploadJobs.js); re-upload after 20 h.
const UPLOAD_FRESH_MS = 20 * 3600 * 1000;

let memory = [];
let dbPromise = null;

function openDb() {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  dbPromise ??= new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

async function tx(mode, fn) {
  const db = await openDb();
  if (!db) return fn(null);
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    let result;
    Promise.resolve(fn(store)).then((r) => {
      result = r;
    });
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
  });
}

const reqToPromise = (req) =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

async function allItems() {
  try {
    const db = await openDb();
    if (!db) return [...memory];
    const store = db.transaction(STORE, "readonly").objectStore(STORE);
    return await reqToPromise(store.getAll());
  } catch {
    return [...memory];
  }
}

async function putItem(item) {
  try {
    const db = await openDb();
    if (!db) {
      memory = [...memory.filter((x) => x.id !== item.id), item];
      return;
    }
    await tx("readwrite", (store) => store.put(item));
  } catch {
    memory = [...memory.filter((x) => x.id !== item.id), item];
  }
}

async function deleteItem(id) {
  memory = memory.filter((x) => x.id !== id);
  try {
    const db = await openDb();
    if (db) await tx("readwrite", (store) => store.delete(id));
  } catch {
    // ignore
  }
}

/** The signed-in person's waiting complaints (newest first) and whether a send is running. */
export const useOutbox = create(() => ({ items: [], sending: false, offline: false }));

async function refresh(userId) {
  const mine = (await allItems())
    .filter((x) => x.userId === userId)
    .sort((a, b) => b.savedAt - a.savedAt);
  useOutbox.setState({ items: mine });
  return mine;
}

export const loadOutbox = (userId) =>
  userId ? refresh(userId) : useOutbox.setState({ items: [] });

/**
 * Saves a complaint to send later. `body` is what POST /complaints takes; `photo` (a Blob) is
 * kept when the photo hasn't reached the server yet, or might expire there before sending.
 */
export async function queueComplaint({ userId, body, photo = null, uploadedAt = null }) {
  const item = {
    id: `c${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
    userId,
    body,
    photo,
    uploadedAt,
    savedAt: Date.now(),
  };
  await putItem(item);
  await refresh(userId);
  return item;
}

export async function discardQueued(userId, id) {
  await deleteItem(id);
  await refresh(userId);
}

const isUploadProblem = (e) => e.details?.some?.((d) => d.field === "uploadId");

async function sendOne(item) {
  // Looked up at send time (the module is already loaded; this also lets tests mock it).
  const { complaintsApi } = await import("../api/endpoints.js");
  let body = { ...item.body };
  const stale = !item.uploadedAt || Date.now() - item.uploadedAt > UPLOAD_FRESH_MS;
  if (item.photo && (!body.uploadId || stale)) {
    const res = await complaintsApi.classify(item.photo);
    body = { ...body, uploadId: res.uploadId };
  }
  try {
    return await complaintsApi.create(body);
  } catch (err) {
    const e = apiError(err);
    // The uploaded photo expired on the server: send it again once.
    if (!e.network && isUploadProblem(e) && item.photo && body.uploadId === item.body.uploadId) {
      const res = await complaintsApi.classify(item.photo);
      return complaintsApi.create({ ...body, uploadId: res.uploadId });
    }
    throw err;
  }
}

/**
 * Sends this person's waiting complaints, oldest first. Stops at the first network failure
 * (still offline); a complaint the server refuses for another reason stays, marked failed.
 * Returns the created complaints.
 */
export async function flushOutbox(userId) {
  if (!userId || useOutbox.getState().sending) return [];
  const items = (await refresh(userId)).slice().reverse();
  if (!items.length) return [];
  useOutbox.setState({ sending: true, offline: false });
  const sent = [];
  try {
    for (const item of items) {
      try {
        const created = await sendOne(item);
        await deleteItem(item.id);
        sent.push(created);
      } catch (err) {
        const e = apiError(err);
        // Still offline (a request that got no answer): try again later.
        if (err?.isAxiosError && e.network) {
          useOutbox.setState({ offline: true });
          break;
        }
        await putItem({
          ...item,
          error: e.message ?? String(err?.message ?? err),
          failedAt: Date.now(),
        });
      }
    }
  } finally {
    useOutbox.setState({ sending: false });
    await refresh(userId);
  }
  return sent;
}

/** For tests. */
export async function clearOutbox() {
  memory = [];
  try {
    const db = await openDb();
    if (db) await tx("readwrite", (store) => store.clear());
  } catch {
    // ignore
  }
  useOutbox.setState({ items: [], sending: false });
}
