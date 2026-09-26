import { createHash, randomBytes } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { logger } from "./logger.js";

// Photo storage (docs/02 §3, §9). Production uses Cloudinary; local development without a
// CLOUDINARY_URL writes to apps/api/.uploads and serves the files at /api/v1/files/:name.
//
// Every driver has the same interface:
//   upload(buffer, { folder, mime }) → { url, publicId, bytes, width?, height? }
//   destroy(publicId)                → true when deleted (or already gone)

export const LOCAL_DIR = fileURLToPath(new URL("../../.uploads/", import.meta.url));
export const LOCAL_NAME = /^[a-f0-9]{32}\.(jpg|png|webp)$/;
const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** Allowed image types, checked by magic bytes, not by the client's MIME type (docs/02 SEC-07). */
export function sniffImage(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return "image/png";
  if (buf.toString("latin1", 0, 4) === "RIFF" && buf.toString("latin1", 8, 12) === "WEBP")
    return "image/webp";
  return null;
}

/** cloudinary://<key>:<secret>@<cloud> → { cloud, key, secret } */
export function parseCloudinaryUrl(url) {
  const u = new URL(url);
  if (u.protocol !== "cloudinary:" || !u.username || !u.password || !u.hostname)
    throw new Error("CLOUDINARY_URL must look like cloudinary://<key>:<secret>@<cloud>");
  return {
    cloud: u.hostname,
    key: decodeURIComponent(u.username),
    secret: decodeURIComponent(u.password),
  };
}

/** Cloudinary signature: sha1 of the sorted params + secret (Cloudinary "signed uploads"). */
export function cloudinarySignature(params, secret) {
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return createHash("sha1")
    .update(toSign + secret)
    .digest("hex");
}

/**
 * Signed uploads over the REST API with fetch (no SDK). The incoming transformation limits the
 * stored image to 1280 px and re-encodes it, which also strips EXIF/GPS (docs/02 §9, SEC-07).
 */
export function createCloudinaryStorage({ url, envName, fetchImpl = fetch }) {
  const { cloud, key, secret } = parseCloudinaryUrl(url);
  const api = `https://api.cloudinary.com/v1_1/${cloud}/image`;

  async function call(action, params, file) {
    const signed = { ...params, timestamp: Math.floor(Date.now() / 1000) };
    const form = new FormData();
    for (const [k, v] of Object.entries(signed)) form.append(k, String(v));
    form.append("api_key", key);
    form.append("signature", cloudinarySignature(signed, secret));
    if (file) form.append("file", file);
    const res = await fetchImpl(`${api}/${action}`, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(20_000),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok)
      throw new Error(`cloudinary ${action} failed: ${body?.error?.message ?? res.status}`);
    return body;
  }

  return {
    driver: "cloudinary",
    async upload(buffer, { folder, mime }) {
      const body = await call(
        "upload",
        { folder: `suraksha/${envName}/${folder}`, transformation: "c_limit,w_1280,q_auto" },
        new Blob([buffer], { type: mime }),
      );
      return {
        url: body.secure_url,
        publicId: body.public_id,
        bytes: body.bytes,
        width: body.width,
        height: body.height,
      };
    },
    async destroy(publicId) {
      const body = await call("destroy", { public_id: publicId, invalidate: true });
      return body.result === "ok" || body.result === "not found";
    },
  };
}

/** Development only: files on disk, served by the API itself. */
export function createLocalStorage({ baseUrl, dir = LOCAL_DIR }) {
  return {
    driver: "local",
    dir,
    async upload(buffer, { folder, mime }) {
      await mkdir(dir, { recursive: true });
      const name = `${randomBytes(16).toString("hex")}.${EXT[mime]}`;
      await writeFile(path.join(dir, name), buffer);
      return {
        url: `${baseUrl}/api/v1/files/${name}`,
        publicId: `local/${folder}/${name}`,
        bytes: buffer.length,
      };
    },
    async destroy(publicId) {
      const name = path.basename(publicId);
      if (!LOCAL_NAME.test(name)) return false;
      await rm(path.join(dir, name), { force: true });
      return true;
    },
  };
}

/** In-memory store for tests. */
export function createMemoryStorage() {
  const files = new Map();
  let n = 0;
  return {
    driver: "memory",
    files,
    async upload(buffer, { folder, mime }) {
      n += 1;
      const publicId = `test/${folder}/${n}`;
      files.set(publicId, { buffer, mime });
      return {
        url: `https://res.cloudinary.com/test/${publicId}.jpg`,
        publicId,
        bytes: buffer.length,
      };
    },
    async destroy(publicId) {
      files.delete(publicId);
      return true;
    },
  };
}

/**
 * Picks the driver from env: Cloudinary when CLOUDINARY_URL is set, local disk in development
 * and test, and none in production without Cloudinary (photo upload then fails and the citizen
 * can continue without a photo, docs/03 S-10 step 1).
 */
export function createStorage(env, { fetchImpl } = {}) {
  if (env.CLOUDINARY_URL)
    return createCloudinaryStorage({
      url: env.CLOUDINARY_URL,
      envName: env.APP_ENV || env.NODE_ENV,
      fetchImpl,
    });
  if (env.NODE_ENV === "production") {
    logger.warn("CLOUDINARY_URL is not set: complaint photos are disabled");
    return null;
  }
  return createLocalStorage({ baseUrl: env.API_PUBLIC_URL ?? `http://localhost:${env.PORT}` });
}
