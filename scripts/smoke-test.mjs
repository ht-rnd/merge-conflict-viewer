/**
 * Installs the packed tarball (what `npm publish` would ship) into a scratch
 * folder next to this project and uses it like a consumer would: ESM import,
 * CommonJS require, and a server render of a viewer built on the headless
 * hook. React is resolved from this project's node_modules.
 *
 * Run `npm run build:ci` first, or use `npm run test:package`.
 */
import { execSync } from "node:child_process"
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const scratch = path.join(root, ".smoke")
const installed = path.join(
  scratch,
  "node_modules",
  "@ht-rnd",
  "merge-conflict-viewer",
)
const run = (command, cwd = root) =>
  execSync(command, { cwd, stdio: ["ignore", "pipe", "inherit"] }).toString()

rmSync(scratch, { recursive: true, force: true })
mkdirSync(installed, { recursive: true })

try {
  const [packed] = JSON.parse(
    run(`npm pack --json --pack-destination "${scratch}"`),
  )
  // Relative paths: GNU tar would read "C:\..." as a remote host.
  run(
    `tar -xzf "${packed.filename}" -C node_modules/@ht-rnd/merge-conflict-viewer --strip-components=1`,
    scratch,
  )

  const shipped = packed.files.map((file) => file.path)
  for (const required of [
    "dist/lib/main.es.js",
    "dist/lib/main.cjs",
    "dist/types/index.d.ts",
  ]) {
    if (!shipped.includes(required)) {
      throw new Error(`The package does not contain ${required}`)
    }
  }
  const stray = shipped.filter(
    (file) => /\.test\.|(^|\/)src\//.test(file) || file.endsWith(".css"),
  )
  if (stray.length > 0) {
    throw new Error(
      `Test, source or style files are shipped: ${stray.join(", ")}`,
    )
  }

  const manifest = JSON.parse(
    readFileSync(path.join(installed, "package.json"), "utf8"),
  )
  if (Object.keys(manifest.dependencies ?? {}).length > 0) {
    throw new Error(
      `The headless package must have no runtime dependencies, found: ${Object.keys(manifest.dependencies).join(", ")}`,
    )
  }
  if (Object.keys(manifest.peerDependencies ?? {}).join() !== "react") {
    throw new Error("React must be the only peer dependency")
  }
  if (manifest.exports["./styles"]) {
    throw new Error("The package must not export styles")
  }

  const usage = `
    const current = { a: 1, b: { c: 2 }, only: "left" }
    const incoming = { a: 2, b: { c: 3 }, extra: true }
    const expected = [
      "useMergeViewer", "useMergeConflicts", "MergeViewerProvider",
      "useMergeViewerContext", "buildMergeTree", "buildMergedJson",
      "buildMergeLayout", "getMergeStatus", "initialSelection", "selectAll",
      "foldRows", "deepEqual", "placeCell", "inlineSegments", "resolveLabels",
      "SCROLL_X_VARIABLE",
    ]
    export function check(lib, renderToString, createElement) {
      for (const name of expected) {
        if (!(name in lib)) throw new Error("missing export " + name)
      }
      for (const name of ["MergeConflictViewer", "cn"]) {
        if (name in lib) throw new Error("unexpected export " + name)
      }

      // A minimal UI built only on the headless hook, rendered on the server.
      function Viewer() {
        const viewer = lib.useMergeViewer({ currentJson: current, incomingJson: incoming })
        return createElement(
          "div",
          viewer.getRootProps(),
          createElement("output", null, viewer.statusText),
          createElement(
            "div",
            viewer.getGridProps(),
            viewer.items.map((item) =>
              item.type === "row"
                ? createElement("pre", { key: item.key, ...viewer.getCellProps(item, "result", "code") }, item.result.text)
                : null,
            ),
          ),
        )
      }
      const html = renderToString(createElement(Viewer))
      if (!html.includes("4 of 4 changes still need a decision")) {
        throw new Error("the server render is missing the status")
      }
      if (!html.includes("data-merge-status") || !html.includes("grid-template-columns")) {
        throw new Error("the prop getters did not produce the expected props")
      }

      const tree = lib.buildMergeTree(current, incoming)
      const merged = lib.buildMergedJson(tree, lib.selectAll(tree, "left"))
      if (JSON.stringify(merged) !== JSON.stringify(current)) {
        throw new Error("the headless API does not merge")
      }
    }
  `
  writeFileSync(path.join(scratch, "usage.mjs"), usage)
  writeFileSync(
    path.join(scratch, "esm.mjs"),
    `import { createElement } from "react"
     import { renderToString } from "react-dom/server"
     import * as lib from "@ht-rnd/merge-conflict-viewer"
     import { check } from "./usage.mjs"
     check(lib, renderToString, createElement)
     console.log("esm ok")`,
  )
  writeFileSync(
    path.join(scratch, "cjs.cjs"),
    `const { createElement } = require("react")
     const { renderToString } = require("react-dom/server")
     const lib = require("@ht-rnd/merge-conflict-viewer")
     import("./usage.mjs").then(({ check }) => {
       check(lib, renderToString, createElement)
       console.log("cjs ok")
     })`,
  )

  process.stdout.write(run("node esm.mjs", scratch))
  process.stdout.write(run("node cjs.cjs", scratch))
  process.stdout.write(
    existsSync(path.join(installed, "dist", "types", "index.d.ts"))
      ? "types ok\n"
      : "",
  )
} finally {
  rmSync(scratch, { recursive: true, force: true })
}
