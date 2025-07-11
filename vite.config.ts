import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  preview: {
    allowedHosts: ["voice-visualizer.loca.lt"],
    host: "0.0.0.0",
    port: 8001, // ← 이 값이 명령줄보다 우선 적용됨
    strictPort: true,
  },
})
