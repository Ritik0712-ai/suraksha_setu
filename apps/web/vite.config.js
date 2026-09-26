import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const shared = fileURLToPath(new URL("../../shared", import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@shared": shared } },
  server: {
    port: 5173,
    fs: { allow: [".", shared] },
    // Same-origin /api like the Vercel rewrite in production (docs/02 §6.2)
    proxy: { "/api": "http://localhost:5000" },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.js"],
  },
});
