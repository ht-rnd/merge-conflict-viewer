import { describe, expect, it } from "vitest"
import { examples } from "../../demo/src/data/examples"
import {
  buildMergedJson,
  buildMergeLayout,
  buildMergeTree,
  initialSelection,
  type MergeLayout,
  type Selection,
  selectAll,
} from "./merge-model"

function pane(layout: MergeLayout, key: "left" | "right" | "result"): unknown {
  return JSON.parse(
    layout.rows
      .map((row) => row[key])
      .filter((line): line is string => line !== null)
      .join("\n"),
  )
}

describe("demo examples", () => {
  for (const [key, example] of Object.entries(examples)) {
    describe(`${key} (${example.label})`, () => {
      const tree = buildMergeTree(example.current, example.incoming)

      it("has a description", () => {
        expect(example.description.length).toBeGreaterThan(10)
      })

      it("renders both sides losslessly", () => {
        const layout = buildMergeLayout(tree, selectAll(tree, "right"))
        expect(pane(layout, "left")).toEqual(example.current)
        expect(pane(layout, "right")).toEqual(example.incoming)
      })

      it("resolves to either side, or any mix, consistently", () => {
        expect(buildMergedJson(tree, selectAll(tree, "left"))).toEqual(
          example.current,
        )
        expect(buildMergedJson(tree, selectAll(tree, "right"))).toEqual(
          example.incoming,
        )

        const mixed: Selection = {}
        tree.conflicts.forEach((entry, i) => {
          mixed[entry.id] = (["left", "right", "deleted"] as const)[i % 3]
        })
        expect(pane(buildMergeLayout(tree, mixed), "result")).toEqual(
          buildMergedJson(tree, mixed),
        )
      })

      it("starts from the side it is told to", () => {
        for (const side of [example.current, example.incoming]) {
          expect(buildMergedJson(tree, initialSelection(tree, side))).toEqual(
            side,
          )
        }
      })

      it("gives every change a unique id and a label", () => {
        const ids = new Set(tree.conflicts.map((c) => c.id))
        expect(ids.size).toBe(tree.conflicts.length)
        expect(tree.conflicts.every((c) => c.label.length > 0)).toBe(true)
      })
    })
  }
})

describe("what each example is meant to show", () => {
  const treeOf = (key: string) =>
    buildMergeTree(examples[key].current, examples[key].incoming)

  const kinds = (key: string) =>
    new Set(treeOf(key).conflicts.map((c) => c.kind))

  it("has exactly the six curated examples", () => {
    expect(Object.keys(examples)).toEqual([
      "userProfile",
      "productCatalog",
      "ciPipeline",
      "deploymentManifest",
      "configMigration",
      "longLines",
    ])
  })

  it("long lines has lines wider than any pane to scroll", () => {
    const longest = Math.max(
      ...JSON.stringify(examples.longLines.current, null, 2)
        .split("\n")
        .map((line) => line.length),
    )
    expect(longest).toBeGreaterThan(120)
    expect(kinds("longLines")).toEqual(new Set(["modified"]))
  })

  it("user profile has edits, removals and additions", () => {
    expect(kinds("userProfile")).toEqual(
      new Set(["modified", "left-only", "right-only"]),
    )
    const labels = treeOf("userProfile").conflicts.map((c) => c.label)
    expect(labels).toContain("phone")
    expect(labels).toContain("address.city")
    expect(labels).toContain("languages[2]")
  })

  it("product catalog matches variants by id and shows moves", () => {
    const tree = treeOf("productCatalog")
    const labels = tree.conflicts.map((c) => c.label)
    expect(labels).toContain("variants[0].price")
    expect(labels).toContain("variants[1].stock")
    expect(
      tree.conflicts.some(
        (c) => c.label.startsWith("colors[") && c.kind === "left-only",
      ),
    ).toBe(true)
    expect(
      tree.conflicts.some(
        (c) => c.label.startsWith("colors[") && c.kind === "right-only",
      ),
    ).toBe(true)
    // v3 was removed and v4 added: different ids, so never merged into one edit.
    const variantSides = tree.conflicts
      .filter((c) => c.label === "variants[2]")
      .map((c) => c.kind)
      .sort()
    expect(variantSides).toEqual(["left-only", "right-only"])
  })

  it("ci pipeline inserts a step cleanly and diffs edited steps field by field", () => {
    const tree = treeOf("ciPipeline")
    const inserted = tree.conflicts.find((c) => c.label === "steps[2]")
    expect(inserted?.kind).toBe("right-only")
    expect(tree.conflicts.map((c) => c.label)).toContain("steps[4].env[1]")
  })

  it("deployment manifest is the full mix", () => {
    const tree = treeOf("deploymentManifest")
    expect(tree.conflicts.length).toBeGreaterThanOrEqual(25)
    expect(kinds("deploymentManifest")).toEqual(
      new Set(["modified", "left-only", "right-only"]),
    )
  })

  it("config migration handles type changes and ambiguous keys", () => {
    const tree = treeOf("configMigration")
    const labels = tree.conflicts.map((c) => c.label)
    expect(labels).toContain('["app.kubernetes.io/version"]')
    expect(labels).toContain("port")
    expect(labels).toContain("limits")
    expect(labels).toContain("legacyMode")
    const typeChanged = tree.conflicts.filter((c) =>
      [
        "port",
        "debug",
        "retries",
        "allowedOrigins",
        "timeoutMs",
        "limits",
        "cache",
      ].includes(c.label),
    )
    expect(typeChanged).toHaveLength(7)
    expect(typeChanged.every((c) => c.kind === "modified")).toBe(true)
    // Unchanged awkward keys are not reported.
    expect(labels).not.toContain('["app.kubernetes.io/name"]')
    expect(labels).not.toContain("greeting")
  })
})
