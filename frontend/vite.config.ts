import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": "http://localhost:8000" } },
  preview: {
    proxy: { "/api": process.env.E2E_API_PROXY || "http://localhost:8000" },
  },
});
