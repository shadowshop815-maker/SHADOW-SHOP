import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  envDir: "../..",
  server: { port: 3001, strictPort: true, host: true },
  build: {
    target: ["es2020", "chrome80", "safari14"],
    chunkSizeWarningLimit: 1000
  }
});
