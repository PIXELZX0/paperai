import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

function normalizeProxyHost(host: string | undefined): string {
  return !host || host === "0.0.0.0" ? "127.0.0.1" : host;
}

const host = process.env.PAPERAI_WEB_HOST ?? process.env.HOST ?? "127.0.0.1";
const apiHost = normalizeProxyHost(
  process.env.PAPERAI_API_HOST ?? process.env.HOST,
);
const webPort = Number(
  process.env.PAPERAI_WEB_PORT ?? process.env.PAPERAI_PORT ?? "3001",
);
const apiPort =
  process.env.PAPERAI_API_PORT ??
  process.env.PAPERAI_INTERNAL_API_PORT ??
  String(webPort + 1);
const apiTarget = `http://${apiHost}:${apiPort}`;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host,
    port: webPort,
    strictPort: true,
    proxy: {
      "/api": {
        target: apiTarget,
        changeOrigin: true,
      },
      "/health": {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
});
