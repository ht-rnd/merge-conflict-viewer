/**
 * Builds the shadcn registry into `public/r/` (served with the demo, so it is
 * published at `<pages url>/r/merge-conflict-viewer.json`).
 *
 * Fails first when the registry item points at a different version of the
 * npm package than the one in the root package.json, so the two can never
 * drift apart.
 */
import { execSync } from "node:child_process"
import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const demo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const read = (file) => JSON.parse(readFileSync(path.join(demo, file), "utf8"))

const { name, version } = read("../package.json")
const registry = read("registry.json")

for (const item of registry.items) {
  const pinned = item.dependencies?.find((dep) => dep.startsWith(`${name}@`))
  if (!pinned) {
    throw new Error(`${item.name} does not depend on ${name}`)
  }
  const [major, minor] = version.split(".")
  const expected = major === "0" ? `^${major}.${minor}.0` : `^${major}.0.0`
  if (pinned !== `${name}@${expected}`) {
    throw new Error(
      `${item.name} depends on ${pinned} but the package is ${version}; expected ${name}@${expected}`,
    )
  }
}

execSync("npx shadcn build", { cwd: demo, stdio: "inherit" })
