import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: "./" makes the built assets load from any static host path (Vercel,
// Netlify, GitHub Pages, a subfolder) without configuration.
export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
});

