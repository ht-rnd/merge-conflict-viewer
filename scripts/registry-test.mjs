/**
 * Installs the registry item into throwaway apps the way a user would, once
 * on Tailwind v3.4 (React 18, PostCSS, HSL tokens) and once on Tailwind v4
 * (React 19, a project without lib/utils.ts), then type checks and builds them.
 *
 *   node scripts/registry-test.mjs            both variants
 *   node scripts/registry-test.mjs v4         one variant
 *
 * What it uses:
 * - the library packed into a tarball (nothing is published yet, and this is
 *   exactly what `npm publish` would ship),
 * - the registry JSON built from the demo (`npm run registry:build`),
 * - the real `shadcn` CLI and the official registry for button, tooltip, ...
 *
 * It needs network access. Work happens in `.registry-test/` (git ignored).
 */
import { execSync } from "node:child_process"
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const work = path.join(root, ".registry-test")
const fixtures = path.join(root, "scripts", "fixtures")
const PACKAGE = "@ht-rnd/merge-conflict-viewer"

const variants = process.argv.slice(2).filter((arg) => /^v\d$/.test(arg))
if (variants.length === 0) {
  variants.push("v3", "v4")
}

const run = (command, cwd = root) => {
  console.log(`\n$ ${command}   (${path.relative(root, cwd) || "."})`)
  execSync(command, { cwd, stdio: "inherit" })
}

const fail = (message) => {
  throw new Error(message)
}

const assert = (condition, message) => {
  if (!condition) {
    fail(message)
  }
}

const read = (...parts) => readFileSync(path.join(...parts), "utf8")

function listFiles(directory) {
  return readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(entry.parentPath, entry.name))
}

// ---- Build what users get --------------------------------------------------

rmSync(work, { recursive: true, force: true })
mkdirSync(work, { recursive: true })

run("npm run build:ci")
const [packed] = JSON.parse(
  execSync(`npm pack --json --pack-destination "${work}"`, {
    cwd: root,
    stdio: ["ignore", "pipe", "inherit"],
  }).toString(),
)
const tarball = path.join(work, packed.filename).replaceAll("\\", "/")

run("npm run registry:build")
const item = JSON.parse(
  read(root, "demo", "public", "r", "merge-conflict-viewer.json"),
)

// The package is not on npm yet (and later, the registry item must still be
// tested against the code in this checkout), so install the tarball instead.
assert(
  item.dependencies.some((dep) => dep.startsWith(`${PACKAGE}@`)),
  `the registry item does not depend on ${PACKAGE}`,
)
const localItem = {
  ...item,
  dependencies: item.dependencies.map((dep) =>
    dep.startsWith(`${PACKAGE}@`) ? tarball : dep,
  ),
}
const itemPath = path.join(work, "merge-conflict-viewer.json")
writeFileSync(itemPath, JSON.stringify(localItem, null, 2))

// ---- Variants --------------------------------------------------------------

function checkVariant(variant) {
  console.log(`\n==== ${variant} ====`)
  const app = path.join(work, variant)
  cpSync(path.join(fixtures, "common"), app, { recursive: true })
  cpSync(path.join(fixtures, variant), app, { recursive: true })

  run("npm install --no-audit --no-fund", app)
  // The CLI treats absolute Windows paths as URLs, so pass a relative path.
  const relativeItem = path.relative(app, itemPath).split(path.sep).join("/")
  run(`npx --yes shadcn@latest add "${relativeItem}" --yes --overwrite`, app)

  // Files the user ends up with.
  const ui = path.join(app, "src", "components", "ui")
  for (const file of [
    "merge-conflict-viewer.tsx",
    "button.tsx",
    "textarea.tsx",
    "progress.tsx",
    "tooltip.tsx",
  ]) {
    assert(existsSync(path.join(ui, file)), `${variant}: ${file} was not added`)
  }
  assert(
    existsSync(path.join(app, "src", "lib", "utils.ts")),
    `${variant}: lib/utils.ts is missing (the utils dependency did not run)`,
  )
  const installedSource = read(ui, "merge-conflict-viewer.tsx")
  assert(
    installedSource.includes(`from "${PACKAGE}"`),
    `${variant}: the component does not import ${PACKAGE}`,
  )

  // Dependencies the CLI installed.
  const manifest = JSON.parse(read(app, "package.json"))
  const dependencies = { ...manifest.dependencies, ...manifest.devDependencies }
  assert(PACKAGE in dependencies, `${variant}: ${PACKAGE} was not installed`)
  assert(
    "lucide-react" in dependencies,
    `${variant}: lucide-react was not installed`,
  )

  // Theme variables the CLI wrote into the user's CSS, for both modes.
  const css = read(app, "src", "index.css")
  for (const name of Object.keys(item.cssVars.light)) {
    assert(
      css.includes(`--${name}:`),
      `${variant}: --${name} is missing from src/index.css`,
    )
  }
  assert(
    css.includes(`--merge-modified: ${item.cssVars.dark["merge-modified"]}`),
    `${variant}: the dark colours were not added`,
  )

  run("npx tsc --noEmit", app)
  run("npx vite build", app)

  // The built stylesheet has the merge classes and the variables they read.
  const [builtCss] = listFiles(path.join(app, "dist", "assets")).filter(
    (file) => file.endsWith(".css"),
  )
  assert(builtCss, `${variant}: the build produced no stylesheet`)
  const output = readFileSync(builtCss, "utf8")
  for (const expected of [
    "--merge-modified:",
    "--merge-pending-border",
    "repeating-linear-gradient",
    "color-mix(in srgb",
  ]) {
    assert(output.includes(expected), `${variant}: built CSS lacks ${expected}`)
  }
  // The declarations must be valid, not just present. Tailwind v3 rewrites "_"
  // inside arbitrary values to a space, which once produced `var(-- x)`: the
  // selector existed, the browser dropped the declaration, nothing was coloured.
  assert(
    !/var\(--\s/.test(output),
    `${variant}: built CSS has a broken variable reference such as "var(-- x)"`,
  )
  assert(
    /\.border-\\\[color\\:var\\\(--mcv-modified-border\\\)\\\]\s*\{[^}]*border-color:\s*var\(--mcv-modified-border\)/.test(
      output,
    ),
    `${variant}: the merge border utility was not generated with a valid value`,
  )
  assert(
    /\.bg-\\\[color\\:var\\\(--mcv-pending\\\)\\\]\s*\{[^}]*background-color:\s*var\(--mcv-pending\)/.test(
      output,
    ),
    `${variant}: the merge background utility was not generated with a valid value`,
  )

  // Built-in defaults, used when a project lacks the --merge-* variables.
  for (const mode of ["light", "dark"]) {
    const value = item.cssVars[mode]["merge-modified"]
    assert(
      new RegExp(
        `--mcv-modified:\\s*var\\(--merge-modified,\\s*${value}\\)`,
      ).test(output),
      `${variant}: the ${mode} default for --merge-modified was not generated`,
    )
  }

  console.log(`\n${variant} ok`)
}

for (const variant of variants) {
  assert(existsSync(path.join(fixtures, variant)), `unknown variant ${variant}`)
  checkVariant(variant)
}
console.log(`\nregistry ok (${variants.join(", ")})`)
