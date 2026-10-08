// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react"
import type { KeyboardEvent } from "react"
import { describe, expect, it, vi } from "vitest"
import {
  type MergePane,
  type MergeViewer,
  type MergeViewerRow,
  type UseMergeViewerOptions,
  useMergeViewer,
} from "./index"
import { inlineSegments, splitInlineEdit } from "./inline-diff"
import { placeCell } from "./placement"
import type { JsonObject } from "./types/index"

const current: JsonObject = { a: 1, b: { c: 2 }, only: "left", same: true }
const incoming: JsonObject = { a: 2, b: { c: 3 }, extra: "right", same: true }

function setup(options: Partial<UseMergeViewerOptions> = {}) {
  return renderHook(
    (props: Partial<UseMergeViewerOptions>) =>
      useMergeViewer({
        currentJson: current,
        incomingJson: incoming,
        ...props,
      }),
    { initialProps: options },
  )
}

const rowsOf = (viewer: MergeViewer): MergeViewerRow[] =>
  viewer.items.filter((item): item is MergeViewerRow => item.type === "row")

const changeId = (viewer: MergeViewer, label: string): string => {
  const entry = viewer.tree.conflicts.find((c) => c.label === label)
  if (!entry) {
    throw new Error(`no change ${label}`)
  }
  return entry.id
}

/** The first line of a change in one pane. */
const firstLine = (viewer: MergeViewer, pane: MergePane, label: string) => {
  const id = changeId(viewer, label)
  const row = rowsOf(viewer).find((r) => r[pane].blockId === id)
  if (!row) {
    throw new Error(`no row for ${label}`)
  }
  return row[pane]
}

const keyEvent = (
  init: Partial<KeyboardEvent<HTMLElement>> & { key: string },
): KeyboardEvent<HTMLElement> =>
  ({
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    preventDefault: vi.fn(),
    target: document.createElement("div"),
    ...init,
  }) as unknown as KeyboardEvent<HTMLElement>

describe("useMergeViewer state", () => {
  it("starts unresolved and describes it", () => {
    const { result } = setup()
    expect(result.current.statusState).toBe("pending")
    expect(result.current.statusText).toBe(
      "4 of 4 changes still need a decision.",
    )
    expect(result.current.merged).toEqual({
      a: 2,
      b: { c: 3 },
      extra: "right",
      same: true,
    })
  })

  it("calls onMergeChange on mount and when the result changes", () => {
    const onMergeChange = vi.fn()
    const { result } = setup({ onMergeChange })
    expect(onMergeChange).toHaveBeenCalledTimes(1)

    act(() => result.current.applyAll("left"))
    const [merged, status] = onMergeChange.mock.calls.at(-1) ?? []
    expect(merged).toEqual(current)
    expect(status.allResolved).toBe(true)
    expect(result.current.statusState).toBe("resolved")
    expect(result.current.statusText).toBe(
      "All 4 changes resolved. Safe to merge.",
    )
  })

  it("reports an empty comparison", () => {
    const { result } = setup({ currentJson: { a: 1 }, incomingJson: { a: 1 } })
    expect(result.current.statusState).toBe("empty")
    expect(result.current.statusText).toBe("No differences. Nothing to merge.")
  })

  it("translates labels", () => {
    const { result } = setup({
      labels: { unresolved: ({ unresolved }) => `${unresolved} offen` },
    })
    expect(result.current.statusText).toBe("4 offen")
    expect(result.current.labels.current).toBe("Current")
  })
})

describe("useMergeViewer render model", () => {
  it("offers accept and remove per side on the first line of a change", () => {
    const { result } = setup()
    const left = firstLine(result.current, "current", "a")
    const right = firstLine(result.current, "incoming", "a")

    expect(left.blockStart).toBe(true)
    expect(left.actions.accept?.label).toBe("Accept current a")
    expect(right.actions.accept?.label).toBe("Accept incoming a")
    expect(left.actions.remove?.label).toBe("Remove a from result")
    // Plain lines have no actions.
    expect(rowsOf(result.current)[0].current.actions).toEqual({})

    act(() => left.actions.accept?.run())
    const after = firstLine(result.current, "current", "a")
    expect(after.actions.accept?.pressed).toBe(true)
    expect(result.current.merged.a).toBe(1)
    expect(result.current.activeId).toBe(changeId(result.current, "a"))
  })

  it("does not offer accept for a side without the key", () => {
    const { result } = setup()
    expect(
      firstLine(result.current, "incoming", "only").actions.accept,
    ).toBeUndefined()
    expect(
      firstLine(result.current, "current", "extra").actions.accept,
    ).toBeUndefined()
  })

  it("derives the state of every cell", () => {
    const { result } = setup()
    expect(rowsOf(result.current)[0].current.state).toBe("unchanged")
    expect(firstLine(result.current, "result", "a").state).toBe("pending")
    expect(firstLine(result.current, "current", "a").state).toBe("changed")
    expect(firstLine(result.current, "current", "extra").state).toBe("filler")

    act(() => firstLine(result.current, "current", "a").actions.accept?.run())
    expect(firstLine(result.current, "result", "a").state).toBe("changed")
    expect(firstLine(result.current, "current", "a").state).toBe("changed")
    expect(firstLine(result.current, "incoming", "a").state).toBe("rejected")
  })

  it("splits modified lines for inline highlighting", () => {
    const { result } = setup()
    const left = firstLine(result.current, "current", "a")
    expect(left.kind).toBe("modified")
    expect(left.segments.map((s) => s.text).join("")).toBe(left.text)
    expect(left.segments.some((s) => s.changed)).toBe(true)
    expect(
      firstLine(result.current, "result", "a").segments.every(
        (s) => !s.changed,
      ),
    ).toBe(true)
  })

  it("keeps line numbers per pane", () => {
    const { result } = setup()
    const first = rowsOf(result.current)[0]
    expect(first.current.lineNo).toBe(1)
    expect(first.result.lineNo).toBe(1)
    expect(first.incoming.lineNo).toBe(1)
  })
})

describe("useMergeViewer folding", () => {
  const wide = Object.fromEntries(
    Array.from({ length: 40 }, (_, i) => [`key${i}`, i]),
  )
  const options = {
    currentJson: wide,
    incomingJson: { ...wide, key20: "changed" },
  }

  it("is off by default", () => {
    const { result } = setup(options)
    expect(result.current.collapsed).toBe(false)
    expect(result.current.items.every((item) => item.type === "row")).toBe(true)
  })

  it("folds long unchanged runs and expands them one at a time", () => {
    const { result } = setup({ ...options, collapseUnchanged: 1 })
    const folds = () =>
      result.current.items.filter((item) => item.type === "fold")
    expect(folds().length).toBe(2)

    const [first] = folds()
    if (first.type !== "fold") {
      throw new Error("expected a fold")
    }
    expect(first.showLabel).toBe(`Show ${first.hidden} unchanged lines`)
    act(() => first.expand())
    expect(folds().length).toBe(1)
  })

  it("can be toggled", () => {
    const { result } = setup({ ...options, collapseUnchanged: true })
    expect(result.current.collapsed).toBe(true)
    act(() => result.current.toggleCollapsed())
    expect(result.current.items.every((item) => item.type === "row")).toBe(true)
  })

  it("makes every fold reachable through one pane only", () => {
    const { result } = setup({ ...options, collapseUnchanged: 1 })
    const fold = result.current.items.find((item) => item.type === "fold")
    if (fold?.type !== "fold") {
      throw new Error("expected a fold")
    }
    const props = result.current.getFoldProps(fold, "current")
    expect(props.tabIndex).toBe(0)
    expect(props["aria-hidden"]).toBeUndefined()
    expect(result.current.getFoldProps(fold, "result").tabIndex).toBe(-1)
    expect(result.current.getFoldProps(fold, "incoming")["aria-hidden"]).toBe(
      true,
    )
  })
})

describe("useMergeViewer navigation", () => {
  it("walks through changes in order and wraps around", () => {
    const { result } = setup()
    const ids = result.current.tree.conflicts.map((c) => c.id)

    for (const id of ids) {
      act(() => result.current.goToChange("next"))
      expect(result.current.activeId).toBe(id)
    }
    act(() => result.current.goToChange("next"))
    expect(result.current.activeId).toBe(ids[0])

    act(() => result.current.goToChange("previous"))
    expect(result.current.activeId).toBe(ids[ids.length - 1])
  })

  it("jumps to the next unresolved change only", () => {
    const { result } = setup()
    const [first, second] = result.current.tree.conflicts
    act(() => result.current.choose(first.id, "left"))

    let found = false
    act(() => {
      found = result.current.goToNextUnresolved()
    })
    expect(found).toBe(true)
    expect(result.current.activeId).toBe(second.id)

    act(() => result.current.applyAll("right"))
    act(() => {
      found = result.current.goToNextUnresolved()
    })
    expect(found).toBe(false)
  })
})

describe("useMergeViewer keyboard", () => {
  it("undoes and redoes with the usual shortcuts", () => {
    const { result } = setup()
    const id = changeId(result.current, "a")
    act(() => result.current.choose(id, "left"))
    expect(result.current.merged.a).toBe(1)

    const undo = keyEvent({ key: "z", ctrlKey: true })
    act(() => result.current.getRootProps().onKeyDown(undo))
    expect(undo.preventDefault).toHaveBeenCalled()
    expect(result.current.merged.a).toBe(2)

    act(() =>
      result.current
        .getRootProps()
        .onKeyDown(keyEvent({ key: "z", ctrlKey: true, shiftKey: true })),
    )
    expect(result.current.merged.a).toBe(1)

    act(() =>
      result.current
        .getRootProps()
        .onKeyDown(keyEvent({ key: "z", metaKey: true })),
    )
    expect(result.current.merged.a).toBe(2)
    act(() =>
      result.current
        .getRootProps()
        .onKeyDown(keyEvent({ key: "y", metaKey: true })),
    )
    expect(result.current.merged.a).toBe(1)
  })

  it("leaves undo to text fields and ignores other keys", () => {
    const { result } = setup()
    act(() => result.current.choose(changeId(result.current, "a"), "left"))

    const field = document.createElement("textarea")
    const inField = keyEvent({ key: "z", ctrlKey: true, target: field })
    act(() => result.current.getRootProps().onKeyDown(inField))
    expect(inField.preventDefault).not.toHaveBeenCalled()
    expect(result.current.merged.a).toBe(1)

    act(() => result.current.getRootProps().onKeyDown(keyEvent({ key: "z" })))
    expect(result.current.merged.a).toBe(1)
  })
})

describe("useMergeViewer editing", () => {
  it("only offers editing when enabled", () => {
    const { result } = setup()
    expect(
      firstLine(result.current, "result", "a").actions.edit,
    ).toBeUndefined()

    const editable = setup({ editable: true })
    expect(
      firstLine(editable.result.current, "result", "a").actions.edit?.label,
    ).toBe("Edit a in result")
  })

  it("opens an editor with the current value", () => {
    const { result } = setup({ editable: true })
    const id = changeId(result.current, "a")
    expect(result.current.editorText(id)).toBe("2")

    act(() => firstLine(result.current, "result", "a").actions.edit?.run())
    expect(result.current.editingId).toBe(id)
    expect(firstLine(result.current, "result", "a").editor).toEqual({
      title: "Edit a (JSON value)",
      inputLabel: "JSON value of a",
      initialText: "2",
    })

    act(() => result.current.cancelEdit())
    expect(result.current.editingId).toBeNull()
    expect(firstLine(result.current, "result", "a").editor).toBeUndefined()
  })

  it("rejects invalid JSON and applies valid JSON", () => {
    const { result } = setup({ editable: true })
    const id = changeId(result.current, "a")
    act(() => result.current.startEdit(id))

    let error: string | null = null
    act(() => {
      error = result.current.commitEdit(id, "{oops")
    })
    expect(error).toEqual(expect.any(String))
    expect(result.current.editingId).toBe(id)
    expect(result.current.status.edited).toBe(0)

    act(() => {
      error = result.current.commitEdit(id, '{"x": [1, 2]}')
    })
    expect(error).toBeNull()
    expect(result.current.editingId).toBeNull()
    expect(result.current.merged.a).toEqual({ x: [1, 2] })
    expect(result.current.status).toMatchObject({ edited: 1, resolved: 1 })
    expect(firstLine(result.current, "result", "a").state).toBe("edited")

    act(() => firstLine(result.current, "result", "a").actions.revert?.run())
    expect(result.current.merged.a).toBe(2)
    expect(result.current.status.edited).toBe(0)
  })
})

describe("useMergeViewer layout", () => {
  it("is side by side by default", () => {
    const { result } = setup()
    expect(result.current.stacked).toBe(false)
    expect(result.current.getGridProps()["data-layout"]).toBe("horizontal")
  })

  it("stacks the panes for layout=vertical and hides filler cells", () => {
    const { result } = setup({ layout: "vertical" })
    expect(result.current.stacked).toBe(true)
    const grid = result.current.getGridProps()
    expect(grid["data-layout"]).toBe("stacked")
    expect(grid.style.display).toBe("grid")

    const row = rowsOf(result.current).find((r) => r.current.state === "filler")
    if (!row) {
      throw new Error("expected a row with filler")
    }
    expect(
      result.current.getCellProps(row, "current", "code").style.display,
    ).toBe("none")
  })

  it("describes cells with data attributes", () => {
    const { result } = setup()
    const row = rowsOf(result.current).find((r) => r.current.blockStart)
    if (!row) {
      throw new Error("expected a block")
    }
    const props = result.current.getCellProps(row, "current", "code")
    expect(props["data-pane"]).toBe("current")
    expect(props["data-column"]).toBe("code")
    expect(props["data-state"]).toBe("changed")
    expect(props["data-kind"]).toBe(row.current.kind)
    expect(props["data-block-start"]).toBe("")
    expect(props["data-merge-block"]).toBe(row.current.blockId)
    // Only the code cell carries the id used for scrolling.
    expect(
      result.current.getCellProps(row, "current", "number")["data-merge-block"],
    ).toBeUndefined()
  })

  it("exposes the status on the root", () => {
    const { result } = setup()
    expect(result.current.getRootProps()["data-merge-status"]).toBe("pending")
    act(() => result.current.applyAll("left"))
    expect(result.current.getRootProps()["data-merge-status"]).toBe("resolved")
  })
})

describe("placeCell", () => {
  it("places the horizontal panes side by side on shared rows", () => {
    expect(placeCell("horizontal", "current", "header", 0, 5)).toEqual({
      gridRow: 1,
      gridColumn: "1 / 4",
    })
    expect(placeCell("horizontal", "current", "code", 0, 5)).toEqual({
      gridRow: 2,
      gridColumn: "1",
    })
    expect(placeCell("horizontal", "result", "code", 3, 5)).toEqual({
      gridRow: 5,
      gridColumn: "5",
    })
    expect(placeCell("horizontal", "incoming", "actions", 3, 5)).toEqual({
      gridRow: 5,
      gridColumn: "7",
    })
    expect(placeCell("horizontal", "incoming", "fold", 2, 5)).toEqual({
      gridRow: 4,
      gridColumn: "6 / 9",
    })
  })

  it("stacks current, incoming and result in bands of rowCount + 1 rows", () => {
    const rows = 5
    expect(placeCell("stacked", "current", "header", 0, rows).gridRow).toBe(1)
    expect(placeCell("stacked", "current", "code", 0, rows).gridRow).toBe(2)
    expect(placeCell("stacked", "incoming", "header", 0, rows).gridRow).toBe(7)
    expect(placeCell("stacked", "incoming", "code", 0, rows).gridRow).toBe(8)
    expect(placeCell("stacked", "result", "header", 0, rows).gridRow).toBe(13)
    expect(placeCell("stacked", "result", "code", 4, rows)).toEqual({
      gridRow: 18,
      gridColumn: "2 / 4",
    })
  })

  it("never lets two cells of different panes share a row when stacked", () => {
    const rows = 4
    const seen = new Set<string>()
    for (const pane of ["current", "incoming", "result"] as const) {
      for (let i = 0; i < rows; i++) {
        const key = String(placeCell("stacked", pane, "code", i, rows).gridRow)
        expect(seen.has(key)).toBe(false)
        seen.add(key)
      }
    }
  })
})

describe("inline diff", () => {
  it("highlights only the characters that differ", () => {
    expect(splitInlineEdit('"a": 1,', '"a": 2,')).toEqual(['"a": ', "1", ","])
    expect(splitInlineEdit("x", null)).toEqual(["x", "", ""])
  })

  it("returns one plain segment when nothing differs or there is no counterpart", () => {
    expect(inlineSegments("same", "same")).toEqual([
      { text: "same", changed: false },
    ])
    expect(inlineSegments("only", undefined)).toEqual([
      { text: "only", changed: false },
    ])
    expect(inlineSegments("only", null)).toEqual([
      { text: "only", changed: false },
    ])
  })

  it("drops empty segments", () => {
    const segments = inlineSegments("abc", "abd")
    expect(segments.map((s) => s.text).join("")).toBe("abc")
    expect(segments.every((s) => s.text.length > 0)).toBe(true)
  })
})
