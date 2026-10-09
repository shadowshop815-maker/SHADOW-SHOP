import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({ mode }) => ({ plugins: [react()], envDir: "../..", define: { __BUILD_MODE__: JSON.stringify(mode) }, server: { port: 3002, strictPort: true, host: true } }));
