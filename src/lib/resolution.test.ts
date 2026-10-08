import { describe, expect, it } from "vitest"
import { foldRows } from "./folding"
import {
  buildMergedJson,
  buildMergeLayout,
  buildMergeTree,
  getMergeStatus,
  initialSelection,
  type Selection,
  selectAll,
} from "./merge-model"

const current = { a: 1, b: { c: 2, d: [1, 2] }, only: "left", same: true }
const incoming = { a: 2, b: { c: 3, d: [1, 2, 3] }, extra: "right", same: true }

const tree = buildMergeTree(current, incoming)
const idOf = (label: string) => {
  const found = tree.conflicts.find((c) => c.label === label)
  if (!found) {
    throw new Error(`no change labelled ${label}`)
  }
  return found.id
}

describe("getMergeStatus", () => {
  it("counts only explicit decisions as resolved", () => {
    expect(getMergeStatus(tree, {})).toEqual({
      total: 5,
      resolved: 0,
      unresolved: 5,
      edited: 0,
      allResolved: false,
    })

    const partial: Selection = {
      [idOf("a")]: "left",
      [idOf("only")]: "deleted",
    }
    const status = getMergeStatus(tree, partial)
    expect(status.resolved).toBe(2)
    expect(status.unresolved).toBe(3)
    expect(status.allResolved).toBe(false)
  })

  it("is fully resolved once every change is decided", () => {
    const status = getMergeStatus(tree, selectAll(tree, "right"))
    expect(status).toMatchObject({ unresolved: 0, allResolved: true })
  })

  it("treats documents without changes as resolved", () => {
    const same = buildMergeTree({ a: 1 }, { a: 1 })
    expect(getMergeStatus(same, {})).toMatchObject({
      total: 0,
      allResolved: true,
    })
  })

  it("counts hand-written values as edited", () => {
    const decisions = {
      ...selectAll(tree, "right"),
      [idOf("a")]: { custom: 42 },
    }
    expect(getMergeStatus(tree, decisions)).toMatchObject({
      edited: 1,
      allResolved: true,
    })
  })
})

describe("custom values", () => {
  const selection: Selection = {
    ...selectAll(tree, "right"),
    [idOf("a")]: { custom: { nested: [true, null] } },
    [idOf("only")]: { custom: "kept" },
  }

  it("replace both sides in the merged document", () => {
    const merged = buildMergedJson(tree, selection)
    expect(merged.a).toEqual({ nested: [true, null] })
    expect(merged.only).toBe("kept")
    expect(merged.extra).toBe("right")
  })

  it("keep every pane valid JSON and mark the block as custom", () => {
    const layout = buildMergeLayout(tree, selection)
    const text = (pane: "left" | "right" | "result") =>
      layout.rows
        .map((row) => row[pane])
        .filter((line) => line !== null)
        .join("\n")

    expect(JSON.parse(text("result"))).toEqual(buildMergedJson(tree, selection))
    expect(JSON.parse(text("left"))).toEqual(current)
    expect(JSON.parse(text("right"))).toEqual(incoming)
    expect(layout.blocks.find((b) => b.id === idOf("a"))?.selection).toBe(
      "custom",
    )
  })

  it("are recovered from an initial merged document", () => {
    const edited = { ...incoming, a: "typed by hand" }
    const derived = initialSelection(tree, edited)
    expect(derived[idOf("a")]).toEqual({ custom: "typed by hand" })
    expect(buildMergedJson(tree, derived)).toEqual(edited)
  })
})

describe("foldRows", () => {
  const lines = (count: number) => Array.from({ length: count }, (_, i) => i)
  const long = Object.fromEntries(lines(30).map((i) => [`key${i}`, i]))
  const changed = { ...long, key15: "changed" }
  const longTree = buildMergeTree(long, changed)
  const rows = buildMergeLayout(longTree, selectAll(longTree, "right")).rows

  it("keeps context around changes and folds the rest", () => {
    const items = foldRows(rows, 2, new Set())
    const folds = items.filter((item) => item.type === "fold")
    expect(folds).toHaveLength(2)

    const shown = items.filter((item) => item.type === "row").length
    const hidden = folds.reduce(
      (sum, item) => sum + (item.type === "fold" ? item.hidden : 0),
      0,
    )
    expect(shown + hidden).toBe(rows.length)
  })

  it("never hides a changed row", () => {
    const items = foldRows(rows, 0, new Set())
    const shownBlocks = items.filter(
      (item) => item.type === "row" && item.row.blockId !== null,
    )
    expect(shownBlocks.length).toBeGreaterThan(0)
  })

  it("leaves expanded folds open", () => {
    const folds = foldRows(rows, 2, new Set()).flatMap((item) =>
      item.type === "fold" ? [item.key] : [],
    )
    const opened = foldRows(rows, 2, new Set(folds))
    expect(opened.every((item) => item.type === "row")).toBe(true)
    expect(opened).toHaveLength(rows.length)
  })

  it("does not fold documents that are short", () => {
    const small = buildMergeTree({ a: 1, b: 2 }, { a: 1, b: 3 })
    const smallRows = buildMergeLayout(small, selectAll(small, "right")).rows
    expect(
      foldRows(smallRows, 3, new Set()).every((item) => item.type === "row"),
    ).toBe(true)
  })

  it("keeps fold keys stable when a block changes size", () => {
    const keysFor = (selection: Selection) =>
      foldRows(
        buildMergeLayout(longTree, selection).rows,
        2,
        new Set(),
      ).flatMap((item) => (item.type === "fold" ? [item.key] : []))
    expect(keysFor(selectAll(longTree, "right"))).toEqual(
      keysFor(selectAll(longTree, "left")),
    )
  })
})
