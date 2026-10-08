// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import type { JsonObject } from "./types/index"
import { useMergeConflicts } from "./use-merge-conflicts"

const current: JsonObject = { a: 1, b: { c: 2 }, only: "left", same: true }
const incoming: JsonObject = { a: 2, b: { c: 3 }, extra: "right", same: true }

describe("useMergeConflicts", () => {
  it("provides the merge without any UI", () => {
    const { result } = renderHook(() =>
      useMergeConflicts({ currentJson: current, incomingJson: incoming }),
    )

    expect(result.current.status.allResolved).toBe(false)
    expect(result.current.merged.a).toBe(2)

    act(() => result.current.applyAll("left"))
    expect(result.current.merged).toEqual(current)
    expect(result.current.status.allResolved).toBe(true)

    act(() => result.current.reset())
    expect(result.current.status.resolved).toBe(0)
  })

  it("keeps a bounded undo history that ignores no-ops", () => {
    const { result } = renderHook(() =>
      useMergeConflicts({ currentJson: current, incomingJson: incoming }),
    )
    const id = result.current.tree.conflicts[0].id

    act(() => result.current.choose(id, "left"))
    act(() => result.current.choose(id, "left"))
    expect(result.current.canUndo).toBe(true)

    act(() => result.current.undo())
    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(true)

    act(() => result.current.choose(id, "right"))
    expect(result.current.canRedo).toBe(false)

    act(() => result.current.applyAll("left"))
    act(() => result.current.reset())
    act(() => result.current.undo())
    expect(result.current.status.allResolved).toBe(true)
  })

  it("starts resolved with startUnresolved=false", () => {
    const { result } = renderHook(() =>
      useMergeConflicts({
        currentJson: current,
        incomingJson: incoming,
        startUnresolved: false,
      }),
    )
    expect(result.current.status.allResolved).toBe(true)
  })

  it("starts over when the documents change", () => {
    const { result, rerender } = renderHook(
      ({ left }: { left: JsonObject }) =>
        useMergeConflicts({ currentJson: left, incomingJson: incoming }),
      { initialProps: { left: current } },
    )
    act(() => result.current.applyAll("left"))
    expect(result.current.status.resolved).toBe(4)

    rerender({ left: { a: 5 } })
    expect(result.current.status.resolved).toBe(0)
  })

  it("works as a controlled hook", () => {
    const seen: unknown[] = []
    const { result, rerender } = renderHook(
      ({ decisions }: { decisions: Record<string, "left"> }) =>
        useMergeConflicts({
          currentJson: current,
          incomingJson: incoming,
          decisions,
          onDecisionsChange: (next) => seen.push(next),
        }),
      { initialProps: { decisions: {} } },
    )

    act(() => result.current.choose('["a"]', "left"))
    expect(seen).toEqual([{ '["a"]': "left" }])
    // Nothing changes until the host passes the decisions back in.
    expect(result.current.status.resolved).toBe(0)

    rerender({ decisions: { '["a"]': "left" } })
    expect(result.current.status.resolved).toBe(1)
  })
})
