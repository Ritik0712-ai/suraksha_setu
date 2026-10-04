import { defineConfig, searchForWorkspaceRoot } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const shared = fileURLToPath(new URL("../../shared", import.meta.url));
// Where /api and /socket.io go in `vite dev` and `vite preview` (the E2E tests use another port).
const apiTarget = process.env.VITE_PROXY_TARGET || "http://localhost:5000";

/**
 * `vite preview` sends the same security headers as Vercel (vercel.json), so the E2E tests run
 * under the production Content-Security-Policy. Locally the API is plain http on another port
 * (photos stored on disk come from there), so localhost is allowed and https upgrades are off.
 */
function previewHeaders() {
  const vercel = JSON.parse(readFileSync(new URL("./vercel.json", import.meta.url), "utf8"));
  const all = vercel.headers.find((h) => h.source === "/(.*)").headers;
  return Object.fromEntries(
    all.map(({ key, value }) => {
      if (key === "Strict-Transport-Security") return [key, "max-age=0"];
      if (key !== "Content-Security-Policy") return [key, value];
      const local = value
        .split("; ")
        .filter((d) => d !== "upgrade-insecure-requests")
        .map((d) =>
          d.startsWith("img-src") || d.startsWith("connect-src")
            ? `${d} http://localhost:* ws://localhost:*`
            : d,
        )
        .join("; ");
      return [key, local];
    }),
  );
}

export default defineConfig({
  plugins: [
    react(),
    // Installable PWA with an offline app shell (docs/01 FR-GEN-06, doc 06 task 3.10).
    VitePWA({
      // "prompt": a new version waits until the user taps "Update" on the bar (UpdateBar.jsx),
      // instead of phones silently running the old version until every tab is closed.
      registerType: "prompt",
      injectRegister: false,
      includeAssets: ["logo.svg", "icons/apple-touch-icon.png"],
      manifest: {
        name: "सुरक्षा सेतु · Suraksha Setu",
        short_name: "सुरक्षा सेतु",
        description:
          "सुरक्षा, शिकायत, योजनाएं — सब एक जगह। Safety, complaints, schemes — all in one place. Independent student project, not a government service.",
        lang: "hi",
        dir: "ltr",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        theme_color: "#003366",
        background_color: "#FFFFFF",
        categories: ["utilities", "lifestyle"],
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/icons/maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
        shortcuts: [
          { name: "SOS", url: "/sos", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
          {
            name: "आपातकालीन नंबर / Emergency numbers",
            url: "/emergency",
            icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
          },
        ],
      },
      workbox: {
        // App shell: every built JS/CSS chunk, the fonts and icons. API calls are never cached.
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: { alias: { "@shared": shared } },
  server: {
    port: 5173,
    // npm workspaces hoist packages (e.g. @fontsource) to the repo root, so allow the whole
    // workspace — otherwise the dev server refuses to serve the font files.
    fs: { allow: [searchForWorkspaceRoot(process.cwd())] },
    // Same-origin /api like the Vercel rewrite in production (docs/02 §6.2)
    proxy: {
      "/api": apiTarget,
      "/socket.io": { target: apiTarget, ws: true },
    },
  },
  preview: { headers: previewHeaders() },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.js"],
  },
});
