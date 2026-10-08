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

/**
 * The component injects its styles at runtime, and the same stylesheet is
 * shipped as `dist/merge-conflict-viewer.css` for apps that render on the
 * server or want to load it themselves.
 */
const emitStylesheet = {
  name: "emit-stylesheet",
  apply: "build" as const,
  generateBundle(this: { emitFile: (file: object) => string }) {
    this.emitFile({
      type: "asset",
      fileName: "merge-conflict-viewer.css",
      source: readFileSync(
        path.resolve(__dirname, "src/components/MergeConflictViewer.css"),
        "utf8",
      ),
    })
  },
}

export default defineConfig({
  plugins: [
    react(),
    emitStylesheet,
    dts({
      insertTypesEntry: true,
      rollupTypes: true,
      outDir: "dist/types",
      include: ["src/lib", "src/components"],
      exclude: ["src/lib/consts/**", "**/*.test.ts", "**/*.test.tsx"],
    }),
  ],
  base: "/",
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
