// @vitest-environment node
import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

// registry.json lives at the repository root (so it also works as a GitHub
// registry); its file paths are relative to that root.
const root = path.resolve(__dirname, "../..")
const read = (file: string) => readFileSync(path.join(root, file), "utf8")

const pkg = JSON.parse(read("package.json")) as {
  name: string
  version: string
}
const registry = JSON.parse(read("registry.json")) as {
  items: {
    name: string
    dependencies: string[]
    registryDependencies: string[]
    files: { path: string }[]
    cssVars: { light: Record<string, string>; dark: Record<string, string> }
  }[]
}
const item = registry.items[0]

/** `--name: value` pairs inside the first block that starts with `selector`. */
function cssBlock(css: string, selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`)
  const end = css.indexOf("\n}", start)
  const vars: Record<string, string> = {}
  for (const [, name, value] of css
    .slice(start, end)
    .matchAll(/--([\w-]+):\s*([^;]+);/g)) {
    vars[name] = value
  }
  return vars
}

describe("registry item", () => {
  it("installs the npm package this repository publishes", () => {
    const [major, minor] = pkg.version.split(".")
    const range = major === "0" ? `^0.${minor}.0` : `^${major}.0.0`
    expect(item.dependencies).toContain(`${pkg.name}@${range}`)
  })

  it("lists only files that exist", () => {
    for (const file of item.files) {
      expect(() => read(file.path)).not.toThrow()
    }
  })

  it("imports only things it declares", () => {
    const source = read(item.files[0].path)
    const shadcn = [
      ...source.matchAll(/from "@\/components\/ui\/([\w-]+)"/g),
    ].map((match) => match[1])
    for (const name of shadcn) {
      expect(item.registryDependencies).toContain(name)
    }
    // Fresh projects may not have lib/utils.ts yet; the `utils` item adds it.
    expect(source).toContain('from "@/lib/utils"')
    expect(item.registryDependencies).toContain("utils")
    expect(source).toContain(`from "${pkg.name}"`)
  })

  it("defines every colour the component uses, in light and dark", () => {
    const source = read(item.files[0].path)
    const used = new Set(
      [...source.matchAll(/var\(--mcv-([\w-]+)\)/g)].map(
        (match) => `merge-${match[1]}`,
      ),
    )
    expect(used.size).toBeGreaterThan(0)
    for (const name of used) {
      expect(item.cssVars.light, `light ${name}`).toHaveProperty(name)
      expect(item.cssVars.dark, `dark ${name}`).toHaveProperty(name)
    }
  })

  it("falls back to the shipped colours when the variables are missing", () => {
    const source = read(item.files[0].path)
    // "[--mcv-x:var(--merge-x,#hex)]" for light, "dark:[...]" for dark.
    const fallbacks = (prefix: string) =>
      Object.fromEntries(
        [
          ...source.matchAll(
            new RegExp(
              `"${prefix}\\[--mcv-([\\w-]+):var\\(--merge-[\\w-]+,([^)]+)\\)\\]"`,
              "g",
            ),
          ),
        ].map((match) => [`merge-${match[1]}`, match[2]]),
      )
    expect(fallbacks("")).toEqual(item.cssVars.light)
    expect(fallbacks("dark:")).toEqual(item.cssVars.dark)
  })

  it("has the same colours in the demo stylesheet as it ships", () => {
    const css = read("demo/src/index.css")
    expect(cssBlock(css, ":root")).toMatchObject(item.cssVars.light)
    expect(cssBlock(css, ".dark")).toMatchObject(item.cssVars.dark)
  })

  it("keeps underscores out of variable names inside arbitrary values", () => {
    const source = read(item.files[0].path)
    // Tailwind v3 turns "_" in an arbitrary value into a space, so
    // bg-[color:var(--_x)] becomes the invalid var(-- x) and nothing is coloured.
    expect(source).not.toMatch(/var\(--[\w-]*_/)
    expect(source).not.toMatch(/\[--_/)
  })

  it("uses no Tailwind v4-only syntax, so it also works on v3.4", () => {
    const source = read(item.files[0].path)
    // bg-(--x) shorthand, not-*/in-* variants, @container and starting: are v4 only.
    expect(source).not.toMatch(/\b[\w-]+-\(--[\w-]+\)/)
    expect(source).not.toMatch(/["'\s](not|in|starting|nth)-[\w[]/)
    expect(source).not.toContain("@container")
    // Arbitrary values must say what they are (bg-[color:...]), v3 cannot guess.
    expect(source).not.toMatch(/(?:bg|border|text)-\[var\(/)
  })
})
