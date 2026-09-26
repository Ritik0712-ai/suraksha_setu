import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import {
  cloudinarySignature,
  createCloudinaryStorage,
  createLocalStorage,
  createStorage,
  parseCloudinaryUrl,
  sniffImage,
} from "../../src/lib/storage.js";
import { fakeAi, testEnv } from "../helpers/app.js";

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xdb]), Buffer.alloc(64)]);
const PNG = Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), Buffer.alloc(64)]);
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBPVP8 ")]);

describe("sniffImage (docs/02 SEC-07)", () => {
  it("recognises JPEG, PNG and WebP by their magic bytes only", () => {
    expect(sniffImage(JPEG)).toBe("image/jpeg");
    expect(sniffImage(PNG)).toBe("image/png");
    expect(sniffImage(WEBP)).toBe("image/webp");
    expect(sniffImage(Buffer.from("GIF89a-------"))).toBeNull();
    expect(sniffImage(Buffer.from("<svg onload=alert(1)>"))).toBeNull();
    expect(sniffImage(Buffer.alloc(3))).toBeNull();
  });
});

describe("Cloudinary driver", () => {
  it("parses CLOUDINARY_URL", () => {
    expect(parseCloudinaryUrl("cloudinary://123:s%40cret@demo")).toEqual({
      cloud: "demo",
      key: "123",
      secret: "s@cret",
    });
    expect(() => parseCloudinaryUrl("https://demo")).toThrow();
  });

  it("signs sorted params + secret with SHA-1 (Cloudinary's documented example)", () => {
    expect(
      cloudinarySignature(
        {
          eager: "w_400,h_300,c_pad|w_260,h_200,c_crop",
          public_id: "sample_image",
          timestamp: 1315060510,
        },
        "abcd",
      ),
    ).toBe("bfd09f95f331f558cbd1320e67aa8d488770583e");
  });

  it("uploads with a signed request into the environment folder, limited to 1280 px", async () => {
    const calls = [];
    const fetchImpl = async (url, init) => {
      calls.push({ url, form: init.body });
      return new Response(
        JSON.stringify({
          secure_url: "https://res.cloudinary.com/demo/image/upload/v1/x.jpg",
          public_id: "suraksha/production/complaints/x",
          bytes: 1234,
          width: 1280,
          height: 960,
        }),
        { status: 200 },
      );
    };
    const s = createCloudinaryStorage({
      url: "cloudinary://key1:sec1@demo",
      envName: "production",
      fetchImpl,
    });
    const out = await s.upload(JPEG, { folder: "complaints", mime: "image/jpeg" });
    expect(out).toEqual({
      url: "https://res.cloudinary.com/demo/image/upload/v1/x.jpg",
      publicId: "suraksha/production/complaints/x",
      bytes: 1234,
      width: 1280,
      height: 960,
    });
    const { url, form } = calls[0];
    expect(url).toBe("https://api.cloudinary.com/v1_1/demo/image/upload");
    expect(form.get("folder")).toBe("suraksha/production/complaints");
    expect(form.get("transformation")).toBe("c_limit,w_1280,q_auto");
    expect(form.get("api_key")).toBe("key1");
    const signed = {
      folder: form.get("folder"),
      transformation: form.get("transformation"),
      timestamp: form.get("timestamp"),
    };
    expect(form.get("signature")).toBe(cloudinarySignature(signed, "sec1"));
    expect(form.get("file")).toBeInstanceOf(Blob);
  });

  it("throws on a Cloudinary error and treats 'not found' as deleted", async () => {
    const failing = createCloudinaryStorage({
      url: "cloudinary://k:s@demo",
      envName: "test",
      fetchImpl: async () =>
        new Response(JSON.stringify({ error: { message: "Invalid Signature" } }), { status: 401 }),
    });
    await expect(failing.upload(JPEG, { folder: "c", mime: "image/jpeg" })).rejects.toThrow(
      /Invalid Signature/,
    );
    const gone = createCloudinaryStorage({
      url: "cloudinary://k:s@demo",
      envName: "test",
      fetchImpl: async () => new Response(JSON.stringify({ result: "not found" })),
    });
    expect(await gone.destroy("x")).toBe(true);
  });
});

describe("driver selection", () => {
  it("Cloudinary when configured, local disk in development, none in production", () => {
    expect(createStorage(testEnv({ CLOUDINARY_URL: "cloudinary://k:s@demo" })).driver).toBe(
      "cloudinary",
    );
    expect(createStorage(testEnv()).driver).toBe("local");
    const prod = testEnv({
      NODE_ENV: "production",
      MONGODB_URI: "mongodb://x",
      AI_INTERNAL_KEY: "k",
      BCRYPT_COST: "12",
    });
    expect(createStorage(prod)).toBeNull();
  });
});

describe("local driver + GET /files/:name (development)", () => {
  let dir;
  afterEach(async () => dir && rm(dir, { recursive: true, force: true }));

  it("saves under a random name and serves it cross-origin", async () => {
    dir = await mkdtemp(path.join(tmpdir(), "ss-uploads-"));
    const storage = createLocalStorage({ baseUrl: "http://localhost:5000", dir });
    const out = await storage.upload(PNG, { folder: "complaints", mime: "image/png" });
    expect(out.url).toMatch(/^http:\/\/localhost:5000\/api\/v1\/files\/[a-f0-9]{32}\.png$/);

    const app = createApp({ env: testEnv(), storage, ai: fakeAi() });
    const name = out.url.split("/").pop();
    const res = await request(app).get(`/api/v1/files/${name}`);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("image/png");
    expect(res.headers["cross-origin-resource-policy"]).toBe("cross-origin");
    expect((await request(app).get("/api/v1/files/..%2F..%2Fpackage.json")).status).toBe(404);
    expect((await request(app).get("/api/v1/files/0000.png")).status).toBe(404);

    expect(await storage.destroy(out.publicId)).toBe(true);
    expect(await readdir(dir)).toEqual([]);
    expect(await storage.destroy("local/complaints/../../etc/passwd")).toBe(false);
  });

  it("serves nothing when photos are on Cloudinary", async () => {
    const app = createApp({ env: testEnv(), storage: null, ai: fakeAi() });
    const res = await request(app).get(`/api/v1/files/${"a".repeat(32)}.jpg`);
    expect(res.status).toBe(404);
  });
});
