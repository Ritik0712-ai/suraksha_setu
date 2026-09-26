// Client-side photo compression before upload (docs/02 §3: ≤ 1280 px, ≤ 500 KB). Saves data on
// 2G/3G and keeps uploads well under the server's 5 MB limit.

export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export const isImageFile = (file) => Boolean(file && /^image\//.test(file.type));

/** Resolves a JPEG File. Falls back to the original when the browser can't compress. */
export async function compressPhoto(file) {
  try {
    const { default: imageCompression } = await import("browser-image-compression");
    const out = await imageCompression(file, {
      maxWidthOrHeight: 1280,
      maxSizeMB: 0.5,
      fileType: "image/jpeg",
      initialQuality: 0.8,
      useWebWorker: true,
    });
    return new File([out], "photo.jpg", { type: "image/jpeg" });
  } catch {
    // HEIC or an old browser: the server still checks type and size.
    return file;
  }
}
