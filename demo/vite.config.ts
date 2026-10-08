import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(__dirname, "./src") },
      // The registry component imports the published package name. In the
      // demo that name resolves to the library source next door.
      {
        find: /^@ht-rnd\/merge-conflict-viewer$/,
        replacement: path.resolve(__dirname, "../src/lib/index.ts"),
      },
      {
        find: "react",
        replacement: path.resolve(__dirname, "./node_modules/react"),
      },
      {
        find: "react-dom",
        replacement: path.resolve(__dirname, "./node_modules/react-dom"),
      },
    ],
  },
  base: "/merge-conflict-viewer",
  server: {
    open: "/merge-conflict-viewer",
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
  },
})
