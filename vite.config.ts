import { readFileSync } from "node:fs"
import path from "node:path"
import react from "@vitejs/plugin-react"
import dts from "vite-plugin-dts"
import { defineConfig } from "vitest/config"

const pkg = JSON.parse(readFileSync("./package.json", "utf8")) as {
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}

const externals = [
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.peerDependencies ?? {}),
]

const isExternal = (id: string): boolean =>
  externals.some((name) => id === name || id.startsWith(`${name}/`))

export default defineConfig({
  plugins: [
    react(),
    dts({
      insertTypesEntry: true,
      rollupTypes: true,
      outDir: "dist/types",
      include: ["src/lib"],
      exclude: ["src/lib/consts/**", "**/*.test.ts", "**/*.test.tsx"],
    }),
  ],
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
  build: {
    lib: {
      entry: path.resolve(__dirname, "src/lib/index.ts"),
      formats: ["es", "cjs"],
      fileName: (format) =>
        format === "es" ? "lib/main.es.js" : "lib/main.cjs",
    },
    outDir: "dist",
    rollupOptions: {
      external: (id) => isExternal(id),
    },
  },
})
