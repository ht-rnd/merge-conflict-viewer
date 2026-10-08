import { describe, expect, it } from "vitest"
import { spec1, spec2 } from "./consts/specifications"
import {
  buildMergedJson,
  buildMergeLayout,
  buildMergeTree,
  initialSelection,
  type MergeLayout,
  type Selection,
  selectAll,
} from "./merge-model"
import type { JsonObject } from "./types/index"

const complexCurrent: JsonObject = {
  service: "billing-api",
  version: 2,
  endpoints: {
    charges: "/v2/charges",
    refunds: "/v2/refunds",
  },
  owner: "platform-team",
  deprecated: true,
  maintenance: {
    enabled: false,
    window: "Sunday 02:00 UTC",
  },
  legacyExportFormat: "csv",
}

const complexIncoming: JsonObject = {
  service: "billing-api",
  version: 3,
  endpoints: {
    charges: "/v3/charges",
    refunds: "/v3/refunds",
    subscriptions: "/v3/subscriptions",
  },
  team: "payments-squad",
  featureFlags: {
    doubleWrite: true,
    newCheckout: false,
  },
  logLevel: "info",
  observability: {
    tracing: true,
    sampleRate: 0.1,
  },
}

const fixtures: Record<string, [JsonObject, JsonObject]> = {
  complex: [complexCurrent, complexIncoming],
  specs: [spec1 as JsonObject, spec2 as JsonObject],
  identical: [
    { a: 1, b: { c: [1, 2] } },
    { a: 1, b: { c: [1, 2] } },
  ],
  empty: [{}, { a: { b: 1 } }],
  typeChange: [
    { a: { b: 1 }, z: 1 },
    { a: [1, 2], z: 1 },
  ],
  lastKeyRemoved: [{ a: 1, b: 2 }, { a: 1 }],
  lastKeyAdded: [{ a: 1 }, { a: 1, b: { c: 2 } }],
  primitiveArrays: [
    { tags: ["audio", "wireless"], nums: [1, 2, 3, 4] },
    { tags: ["audio", "wireless", "noise-cancelling"], nums: [1, 3, 4, 5] },
  ],
  arraysOfObjectsWithIds: [
    {
      items: [
        { id: "a", v: 1, tags: ["x"] },
        { id: "b", v: 2 },
      ],
    },
    {
      items: [
        { id: "a", v: 5, tags: ["x", "y"] },
        { id: "b", v: 2 },
        { id: "c", v: 0 },
      ],
    },
  ],
  arraysOfObjectsWithoutIds: [
    { list: [{ x: 1, inner: [1, 2] }, { x: 2 }, { x: 3 }] },
    { list: [{ x: 1, inner: [1, 2, 3] }, { x: 9 }] },
  ],
  nestedArrays: [
    { grid: [[1, 2], [3], []] },
    {
      grid: [
        [1, 2, 3],
        [3, 4],
      ],
    },
  ],
  reorderedIds: [
    { items: [{ id: 1 }, { id: 2 }, { id: 3 }] },
    { items: [{ id: 3 }, { id: 1 }, { id: 2, extra: true }] },
  ],
  typeChangeInsideArray: [
    { list: [1, { a: 1 }, [1]] },
    { list: ["1", [1], { a: 2 }] },
  ],
  arrayToEmpty: [{ list: [1, 2] }, { list: [] }],
  emptyToArray: [{ list: [] }, { list: [{ a: [1] }] }],
}

function pane(layout: MergeLayout, key: "left" | "right" | "result"): unknown {
  const text = layout.rows
    .map((row) => row[key])
    .filter((line): line is string => line !== null)
    .join("\n")
  return JSON.parse(text)
}

function mixedSelection(tree: ReturnType<typeof buildMergeTree>): Selection {
  const selection: Selection = {}
  tree.conflicts.forEach((entry, i) => {
    selection[entry.id] = (["left", "right", "deleted"] as const)[i % 3]
  })
  return selection
}

describe("buildMergeLayout", () => {
  for (const [name, [current, incoming]] of Object.entries(fixtures)) {
    describe(name, () => {
      const tree = buildMergeTree(current, incoming)

      it("renders each side pane as valid JSON equal to its source", () => {
        const layout = buildMergeLayout(tree, selectAll(tree, "right"))
        expect(pane(layout, "left")).toEqual(current)
        expect(pane(layout, "right")).toEqual(incoming)
      })

      it("renders the result pane equal to the merged JSON", () => {
        for (const selection of [
          selectAll(tree, "left"),
          selectAll(tree, "right"),
          mixedSelection(tree),
        ]) {
          const layout = buildMergeLayout(tree, selection)
          expect(pane(layout, "result")).toEqual(
            buildMergedJson(tree, selection),
          )
        }
      })

      it("keeps the layout independent of the selection", () => {
        const a = buildMergeLayout(tree, selectAll(tree, "left"))
        const b = buildMergeLayout(tree, selectAll(tree, "right"))
        expect(a.rows.length).toBe(b.rows.length)
        expect(a.rows.map((r) => r.left)).toEqual(b.rows.map((r) => r.left))
        expect(a.rows.map((r) => r.right)).toEqual(b.rows.map((r) => r.right))
      })
    })
  }

  it("selecting all of one side reproduces that side", () => {
    const tree = buildMergeTree(complexCurrent, complexIncoming)
    expect(buildMergedJson(tree, selectAll(tree, "left"))).toEqual(
      complexCurrent,
    )
    expect(buildMergedJson(tree, selectAll(tree, "right"))).toEqual(
      complexIncoming,
    )
  })
})

describe("one-sided keys (complex example)", () => {
  const tree = buildMergeTree(complexCurrent, complexIncoming)
  const layout = buildMergeLayout(tree, selectAll(tree, "right"))

  it("pads the missing side with empty cells instead of pairing other keys", () => {
    const maintenance = layout.blocks.find(
      (block) => block.entry.key === "maintenance",
    )
    expect(maintenance?.kind).toBe("left-only")
    expect(maintenance?.size).toBe(4)

    const rows = layout.rows.slice(
      maintenance?.start,
      (maintenance?.start ?? 0) + (maintenance?.size ?? 0),
    )
    expect(rows.map((r) => r.left?.trim())).toEqual([
      '"maintenance": {',
      '"enabled": false,',
      '"window": "Sunday 02:00 UTC"',
      "},",
    ])
    expect(rows.every((r) => r.right === null)).toBe(true)

    const featureFlags = layout.blocks.find(
      (block) => block.entry.key === "featureFlags",
    )
    expect(featureFlags?.kind).toBe("right-only")
    const flagRows = layout.rows.slice(
      featureFlags?.start,
      (featureFlags?.start ?? 0) + (featureFlags?.size ?? 0),
    )
    expect(flagRows.every((r) => r.left === null)).toBe(true)
  })

  it("never lets the two one-sided blocks share rows", () => {
    const maintenance = layout.blocks.find((b) => b.entry.key === "maintenance")
    const featureFlags = layout.blocks.find(
      (b) => b.entry.key === "featureFlags",
    )
    expect(
      (maintenance?.start ?? 0) + (maintenance?.size ?? 0),
    ).toBeLessThanOrEqual(featureFlags?.start ?? 0)
  })

  it("accepting current brings the whole key, not merged fields", () => {
    const maintenanceId = tree.conflicts.find(
      (c) => c.key === "maintenance",
    )?.id
    const featureFlagsId = tree.conflicts.find(
      (c) => c.key === "featureFlags",
    )?.id
    expect(maintenanceId).toBeDefined()
    expect(featureFlagsId).toBeDefined()

    const selection: Selection = {
      ...selectAll(tree, "right"),
      [maintenanceId as string]: "left",
    }
    const merged = buildMergedJson(tree, selection)

    expect(merged.maintenance).toEqual(complexCurrent.maintenance)
    expect(merged.featureFlags).toEqual(complexIncoming.featureFlags)
    expect(merged.enabled).toBeUndefined()
  })

  it("accepting current on an incoming-only key drops it from the result", () => {
    const id = tree.conflicts.find((c) => c.key === "featureFlags")?.id
    const merged = buildMergedJson(tree, {
      ...selectAll(tree, "right"),
      [id as string]: "left",
    })
    expect(merged.featureFlags).toBeUndefined()
  })
})

describe("initialSelection", () => {
  const tree = buildMergeTree(complexCurrent, complexIncoming)

  it("defaults to incoming", () => {
    const selection = initialSelection(tree)
    expect(buildMergedJson(tree, selection)).toEqual(complexIncoming)
  })

  it("derives sides from an initial merged document", () => {
    expect(
      buildMergedJson(tree, initialSelection(tree, complexCurrent)),
    ).toEqual(complexCurrent)
    expect(
      buildMergedJson(tree, initialSelection(tree, complexIncoming)),
    ).toEqual(complexIncoming)
  })
})

function conflictLabels(tree: ReturnType<typeof buildMergeTree>): string[] {
  return tree.conflicts.map((c) => c.label)
}

describe("arrays", () => {
  it("turns each added or removed primitive item into its own change", () => {
    const tree = buildMergeTree({ nums: [1, 2, 3, 4] }, { nums: [1, 3, 4, 5] })

    expect(tree.conflicts.map((c) => [c.label, c.kind])).toEqual([
      ["nums[1]", "left-only"],
      ["nums[3]", "right-only"],
    ])

    const [removed, added] = tree.conflicts
    expect(
      buildMergedJson(tree, {
        [removed.id]: "left",
        [added.id]: "right",
      }),
    ).toEqual({ nums: [1, 2, 3, 4, 5] })
    expect(
      buildMergedJson(tree, {
        [removed.id]: "right",
        [added.id]: "left",
      }),
    ).toEqual({ nums: [1, 3, 4] })
  })

  it("pairs edited primitives by position", () => {
    const tree = buildMergeTree({ nums: [1, 2, 3] }, { nums: [1, 5, 3] })
    expect(tree.conflicts.map((c) => [c.label, c.kind])).toEqual([
      ["nums[1]", "modified"],
    ])
  })

  it("matches objects by id and recurses into edited ones", () => {
    const tree = buildMergeTree(
      fixtures.arraysOfObjectsWithIds[0],
      fixtures.arraysOfObjectsWithIds[1],
    )

    expect(conflictLabels(tree)).toEqual([
      "items[0].v",
      "items[0].tags[1]",
      "items[2]",
    ])
    expect(tree.conflicts.map((c) => c.kind)).toEqual([
      "modified",
      "right-only",
      "right-only",
    ])

    const [value, tag, added] = tree.conflicts
    expect(
      buildMergedJson(tree, {
        [value.id]: "left",
        [tag.id]: "right",
        [added.id]: "left",
      }),
    ).toEqual({
      items: [
        { id: "a", v: 1, tags: ["x", "y"] },
        { id: "b", v: 2 },
      ],
    })
  })

  it("pairs unmatched objects by position when there are no ids", () => {
    const tree = buildMergeTree(
      fixtures.arraysOfObjectsWithoutIds[0],
      fixtures.arraysOfObjectsWithoutIds[1],
    )

    expect(conflictLabels(tree)).toEqual([
      "list[0].inner[2]",
      "list[1].x",
      "list[2]",
    ])
    expect(tree.conflicts.map((c) => c.kind)).toEqual([
      "right-only",
      "modified",
      "left-only",
    ])
  })

  it("treats a single item with a new id as an edit, not remove + add", () => {
    const tree = buildMergeTree(
      { list: [{ id: "a", v: 1 }] },
      { list: [{ id: "b", v: 1 }] },
    )
    expect(tree.conflicts.map((c) => [c.label, c.kind])).toEqual([
      ["list[0].id", "modified"],
    ])
  })

  it("keeps items matched by id even when their position moved", () => {
    const tree = buildMergeTree(
      fixtures.reorderedIds[0],
      fixtures.reorderedIds[1],
    )
    const layout = buildMergeLayout(tree, selectAll(tree, "left"))
    expect(pane(layout, "left")).toEqual(fixtures.reorderedIds[0])
    expect(pane(layout, "right")).toEqual(fixtures.reorderedIds[1])
    expect(pane(layout, "result")).toEqual(fixtures.reorderedIds[0])
  })

  it("recurses through arrays inside objects inside arrays", () => {
    const tree = buildMergeTree(
      { a: [{ id: 1, b: [{ id: "x", c: [1, 2] }] }] },
      { a: [{ id: 1, b: [{ id: "x", c: [1, 2, 3] }, { id: "y" }] }] },
    )
    expect(conflictLabels(tree)).toEqual(["a[0].b[0].c[2]", "a[0].b[1]"])
  })

  it("derives initial sides for array items from a merged document", () => {
    const tree = buildMergeTree({ t: [1, 2], a: 1 }, { t: [1, 3], a: 2 })
    const selection = initialSelection(tree, { t: [1, 3], a: 1 })
    expect(buildMergedJson(tree, selection)).toEqual({ t: [1, 3], a: 1 })
  })
})

describe("randomised documents", () => {
  function rng(seed: number): () => number {
    let state = seed
    return () => {
      state = (state + 0x6d2b79f5) | 0
      let t = Math.imul(state ^ (state >>> 15), 1 | state)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }

  const KEYS = ["id", "name", "a", "b", "c", "d"]

  function randomValue(next: () => number, depth: number): unknown {
    const roll = next()
    if (depth <= 0 || roll < 0.45) {
      const p = next()
      if (p < 0.4) return Math.floor(next() * 4)
      if (p < 0.7) return ["x", "y", "z", "w"][Math.floor(next() * 4)]
      if (p < 0.85) return next() < 0.5
      return null
    }
    if (roll < 0.72) {
      const length = Math.floor(next() * 5)
      return Array.from({ length }, () => randomValue(next, depth - 1))
    }
    return randomObject(next, depth - 1)
  }

  function randomObject(next: () => number, depth: number): JsonObject {
    const out: JsonObject = {}
    for (const key of KEYS) {
      if (next() < 0.5) out[key] = randomValue(next, depth)
    }
    return out
  }

  function mutate(next: () => number, value: unknown, depth: number): unknown {
    const roll = next()
    if (Array.isArray(value)) {
      const items = value.map((item) =>
        next() < 0.35 ? mutate(next, item, depth - 1) : item,
      )
      if (next() < 0.4 && items.length > 0) {
        items.splice(Math.floor(next() * items.length), 1)
      }
      if (next() < 0.4) {
        items.splice(
          Math.floor(next() * (items.length + 1)),
          0,
          randomValue(next, depth - 1),
        )
      }
      return items
    }
    if (typeof value === "object" && value !== null) {
      const out: JsonObject = {}
      for (const [key, item] of Object.entries(value)) {
        if (next() < 0.15) continue
        out[key] = next() < 0.4 ? mutate(next, item, depth - 1) : item
      }
      if (next() < 0.3)
        out[KEYS[Math.floor(next() * KEYS.length)]] = randomValue(
          next,
          depth - 1,
        )
      return out
    }
    return roll < 0.5 ? randomValue(next, 0) : value
  }

  it("keeps every pane valid and every selection consistent", () => {
    for (let seed = 1; seed <= 400; seed++) {
      const next = rng(seed)
      const current = randomObject(next, 3)
      const incoming = (
        next() < 0.8 ? mutate(next, current, 3) : randomObject(next, 3)
      ) as JsonObject
      const context = `seed ${seed}`

      const tree = buildMergeTree(current, incoming)
      const layout = buildMergeLayout(tree, selectAll(tree, "right"))

      expect(pane(layout, "left"), context).toEqual(current)
      expect(pane(layout, "right"), context).toEqual(incoming)
      expect(buildMergedJson(tree, selectAll(tree, "left")), context).toEqual(
        current,
      )
      expect(buildMergedJson(tree, selectAll(tree, "right")), context).toEqual(
        incoming,
      )

      const mixed: Selection = {}
      for (const entry of tree.conflicts) {
        mixed[entry.id] = (["left", "right", "deleted"] as const)[
          Math.floor(next() * 3)
        ]
      }
      expect(pane(buildMergeLayout(tree, mixed), "result"), context).toEqual(
        buildMergedJson(tree, mixed),
      )

      const ids = new Set(tree.conflicts.map((c) => c.id))
      expect(ids.size, context).toBe(tree.conflicts.length)
    }
  })
})
