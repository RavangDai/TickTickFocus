import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "favicon.svg",
        "favicon.ico",
        "apple-touch-icon.png",
        "masked-icon.svg",
      ],
      manifest: {
        name: "TickTickFocus",
        short_name: "TickTickFocus",
        description:
          "A calm pomodoro-style timer for deep work with modes, history, and keyboard shortcuts.",
        theme_color: "#020617", // dark slate
        background_color: "#020617",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons: [
          {
            src: "/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/pwa-512x512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
        screenshots: [
  {
    src: "/screenshot-wide.png",
    sizes: "1280x720",
    type: "image/png",
    form_factor: "wide"
  },
  {
    src: "/screenshot-mobile.png",
    sizes: "720x1280",
    type: "image/png",
    form_factor: "narrow"
  }
],

      },
      workbox: {
        // cache the important routes & assets for offline use
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
      },
      devOptions: {
        enabled: false, // you can set true to test SW in dev if you want
      },
    }),
  ],
});
