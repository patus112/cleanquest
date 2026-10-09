import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
const base = process.env.VITE_BASE_PATH || "/cleanquest/";
export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      scope: base,
      includeAssets: ["apple-touch-icon.png"],
      manifest: {
        id: base,
        name: "CleanQuest",
        short_name: "CleanQuest",
        description: "Malé kroky pre pokojnejší domov.",
        lang: "sk",
        start_url: base,
        scope: base,
        display: "standalone",
        background_color: "#101216",
        theme_color: "#101216",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icon-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,woff2}"],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        navigateFallback: "index.html",
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes("node_modules/react") ||
            id.includes("node_modules/scheduler")
          )
            return "framework";
          if (id.includes("node_modules/dexie")) return "storage";
          if (id.includes("node_modules/zod")) return "validation";
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
  },
});
