// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react"
import { createRef } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { JsonObject } from "../lib/types"
import { useMergeConflicts } from "../lib/use-merge-conflicts"
import {
  MergeConflictViewer,
  type MergeConflictViewerHandle,
} from "./MergeConflictViewer"

const current: JsonObject = { a: 1, b: { c: 2 }, only: "left", same: true }
const incoming: JsonObject = { a: 2, b: { c: 3 }, extra: "right", same: true }

afterEach(() => {
  cleanup()
})

const lastCall = (fn: ReturnType<typeof vi.fn>) =>
  fn.mock.calls[fn.mock.calls.length - 1]

describe("MergeConflictViewer", () => {
  it("injects its own stylesheet once", () => {
    render(
      <MergeConflictViewer currentJson={current} incomingJson={incoming} />,
    )
    render(
      <MergeConflictViewer currentJson={current} incomingJson={incoming} />,
    )
    expect(document.querySelectorAll("style#mcv-styles")).toHaveLength(1)
  })

  it("starts unresolved and reports it", () => {
    const onMergeChange = vi.fn()
    render(
      <MergeConflictViewer
        currentJson={current}
        incomingJson={incoming}
        onMergeChange={onMergeChange}
      />,
    )

    expect(screen.getByRole("status").textContent).toBe(
      "4 of 4 changes still need a decision.",
    )
    const [merged, status] = lastCall(onMergeChange)
    expect(merged).toEqual({ a: 2, b: { c: 3 }, extra: "right", same: true })
    expect(status).toMatchObject({
      total: 4,
      unresolved: 4,
      allResolved: false,
    })
  })

  it("announces when everything is resolved", () => {
    const onMergeChange = vi.fn()
    render(
      <MergeConflictViewer
        currentJson={current}
        incomingJson={incoming}
        onMergeChange={onMergeChange}
      />,
    )

    fireEvent.click(screen.getByLabelText("Accept current a"))
    fireEvent.click(screen.getByLabelText("Accept incoming b.c"))
    fireEvent.click(screen.getByLabelText("Accept current only"))
    expect(screen.getByRole("status").textContent).toBe(
      "1 of 4 changes still needs a decision.",
    )
    expect(screen.queryByText("Next unresolved")).not.toBeNull()

    fireEvent.click(screen.getByLabelText("Accept incoming extra"))
    expect(screen.getByRole("status").textContent).toBe(
      "All 4 changes resolved. Safe to merge.",
    )
    expect(screen.queryByText("Next unresolved")).toBeNull()

    const [merged, status] = lastCall(onMergeChange)
    expect(merged).toEqual({
      a: 1,
      b: { c: 3 },
      only: "left",
      extra: "right",
      same: true,
    })
    expect(status.allResolved).toBe(true)
  })

  it("treats an initial result as decided", () => {
    render(
      <MergeConflictViewer
        currentJson={current}
        incomingJson={incoming}
        initialMergedJson={incoming}
      />,
    )
    expect(screen.getByRole("status").textContent).toContain("Safe to merge")
  })

  it("lets the host override the status messages", () => {
    render(
      <MergeConflictViewer
        currentJson={{ a: 1 }}
        incomingJson={{ a: 1 }}
        labels={{ noChanges: "Identical" }}
      />,
    )
    expect(screen.getByRole("status").textContent).toBe("Identical")
  })

  it("lets the host translate every label", () => {
    render(
      <MergeConflictViewer
        currentJson={current}
        incomingJson={incoming}
        editable
        labels={{
          current: "Aktuell",
          applyAllCurrent: "Alle aktuellen",
          unresolved: ({ unresolved }) => `${unresolved} offen`,
          acceptCurrent: (change) => `Aktuell ${change}`,
          nextUnresolved: "Weiter",
        }}
      />,
    )
    expect(screen.getByText("Aktuell")).not.toBeNull()
    expect(screen.getByText("Alle aktuellen")).not.toBeNull()
    expect(screen.getByRole("status").textContent).toBe("4 offen")
    expect(screen.getByLabelText("Aktuell a")).not.toBeNull()
    expect(screen.getByText("Weiter")).not.toBeNull()
    // Untouched labels keep their defaults.
    expect(screen.getByText("Result")).not.toBeNull()
    expect(screen.queryByLabelText("Edit a in result")).not.toBeNull()
  })

  it("shows progress and exposes the state for styling and tests", () => {
    const { container } = render(
      <MergeConflictViewer currentJson={current} incomingJson={incoming} />,
    )
    const root = container.firstElementChild as HTMLElement
    const bar = () =>
      (root.querySelector(".mcv-progress-bar") as HTMLElement).style.width
    expect(root.dataset.mcvStatus).toBe("pending")
    expect(bar()).toBe("0%")

    fireEvent.click(screen.getByLabelText("Accept current a"))
    expect(bar()).toBe("25%")

    fireEvent.click(screen.getByText("Apply all from incoming"))
    expect(root.dataset.mcvStatus).toBe("resolved")
    expect(bar()).toBe("100%")
  })

  it("undoes and redoes decisions, also from the keyboard", () => {
    const onMergeChange = vi.fn()
    const { container } = render(
      <MergeConflictViewer
        currentJson={current}
        incomingJson={incoming}
        onMergeChange={onMergeChange}
      />,
    )
    const root = container.firstElementChild as HTMLElement
    const undo = screen.getByLabelText("Undo") as HTMLButtonElement
    const redo = screen.getByLabelText("Redo") as HTMLButtonElement
    expect(undo.disabled).toBe(true)

    fireEvent.click(screen.getByLabelText("Accept current a"))
    expect(undo.disabled).toBe(false)
    expect(lastCall(onMergeChange)[0].a).toBe(1)

    fireEvent.click(undo)
    expect(lastCall(onMergeChange)[0].a).toBe(2)
    expect(lastCall(onMergeChange)[1].resolved).toBe(0)
    expect(redo.disabled).toBe(false)

    fireEvent.keyDown(root, { key: "z", ctrlKey: true, shiftKey: true })
    expect(lastCall(onMergeChange)[0].a).toBe(1)

    fireEvent.keyDown(root, { key: "z", ctrlKey: true })
    expect(lastCall(onMergeChange)[0].a).toBe(2)
    fireEvent.keyDown(root, { key: "y", metaKey: true })
    expect(lastCall(onMergeChange)[0].a).toBe(1)
  })

  it("leaves undo to text fields while editing", () => {
    render(
      <MergeConflictViewer
        currentJson={current}
        incomingJson={incoming}
        editable
      />,
    )
    fireEvent.click(screen.getByLabelText("Accept current a"))
    fireEvent.click(screen.getByLabelText("Edit b.c in result"))
    fireEvent.keyDown(screen.getByLabelText("JSON value of b.c"), {
      key: "z",
      ctrlKey: true,
    })
    expect(screen.getByRole("status").textContent).toContain("3 of 4")
  })

  it("exposes an imperative handle", () => {
    const ref = createRef<MergeConflictViewerHandle>()
    render(
      <MergeConflictViewer
        ref={ref}
        currentJson={current}
        incomingJson={incoming}
      />,
    )

    expect(ref.current?.getStatus().allResolved).toBe(false)
    act(() => ref.current?.applyAll("left"))
    expect(ref.current?.getResult()).toEqual(current)
    expect(ref.current?.getStatus().allResolved).toBe(true)
    expect(ref.current?.goToNextUnresolved()).toBe(false)

    act(() => ref.current?.reset())
    expect(ref.current?.getStatus().unresolved).toBe(4)
    expect(ref.current?.goToNextUnresolved()).toBe(true)

    act(() => ref.current?.undo())
    expect(ref.current?.getStatus().allResolved).toBe(true)
    act(() => ref.current?.redo())
    expect(ref.current?.getStatus().unresolved).toBe(4)
  })

  it("works as a controlled component", () => {
    const onDecisionsChange = vi.fn()
    const { rerender } = render(
      <MergeConflictViewer
        currentJson={current}
        incomingJson={incoming}
        decisions={{}}
        onDecisionsChange={onDecisionsChange}
      />,
    )

    fireEvent.click(screen.getByLabelText("Accept current a"))
    expect(onDecisionsChange).toHaveBeenCalledWith({ '["a"]': "left" })
    // Nothing changes until the host passes the decisions back in.
    expect(screen.getByRole("status").textContent).toContain("4 of 4")

    rerender(
      <MergeConflictViewer
        currentJson={current}
        incomingJson={incoming}
        decisions={{ '["a"]': "left" }}
        onDecisionsChange={onDecisionsChange}
      />,
    )
    expect(screen.getByRole("status").textContent).toContain("3 of 4")
  })

  it("only offers editing when enabled", () => {
    const { rerender } = render(
      <MergeConflictViewer currentJson={current} incomingJson={incoming} />,
    )
    expect(screen.queryByLabelText("Edit a in result")).toBeNull()

    rerender(
      <MergeConflictViewer
        currentJson={current}
        incomingJson={incoming}
        editable
      />,
    )
    expect(screen.queryByLabelText("Edit a in result")).not.toBeNull()
  })

  it("edits a value by hand, validates it and can revert", () => {
    const onMergeChange = vi.fn()
    render(
      <MergeConflictViewer
        currentJson={current}
        incomingJson={incoming}
        onMergeChange={onMergeChange}
        editable
      />,
    )

    fireEvent.click(screen.getByLabelText("Edit a in result"))
    const input = screen.getByLabelText("JSON value of a")
    expect((input as HTMLTextAreaElement).value).toBe("2")

    fireEvent.change(input, { target: { value: "{oops" } })
    fireEvent.click(screen.getByText("Apply"))
    expect(screen.getByRole("alert")).not.toBeNull()

    fireEvent.change(input, { target: { value: '{"x": [1, 2]}' } })
    fireEvent.click(screen.getByText("Apply"))
    expect(screen.queryByLabelText("JSON value of a")).toBeNull()

    const [merged, status] = lastCall(onMergeChange)
    expect(merged.a).toEqual({ x: [1, 2] })
    expect(status).toMatchObject({ edited: 1, resolved: 1 })

    fireEvent.click(screen.getByLabelText("Revert edit of a"))
    expect(lastCall(onMergeChange)[0].a).toBe(2)
    expect(lastCall(onMergeChange)[1]).toMatchObject({ edited: 0, resolved: 0 })
  })

  it("cancels an edit with Escape", () => {
    render(
      <MergeConflictViewer
        currentJson={current}
        incomingJson={incoming}
        editable
      />,
    )
    fireEvent.click(screen.getByLabelText("Edit a in result"))
    fireEvent.keyDown(screen.getByLabelText("JSON value of a"), {
      key: "Escape",
    })
    expect(screen.queryByLabelText("JSON value of a")).toBeNull()
  })

  it("folds unchanged lines on request", () => {
    const wide = Object.fromEntries(
      Array.from({ length: 40 }, (_, i) => [`key${i}`, i]),
    )
    render(
      <MergeConflictViewer
        currentJson={wide}
        incomingJson={{ ...wide, key20: "changed" }}
        collapseUnchanged={1}
      />,
    )

    const folds = screen.getAllByLabelText(/^Show \d+ unchanged lines$/)
    expect(folds.length).toBeGreaterThan(0)
    fireEvent.click(folds[0])
    expect(screen.getAllByLabelText(/^Show \d+ unchanged lines$/)).toHaveLength(
      folds.length - 3,
    )
  })

  it("can hide the toolbar and the status banner", () => {
    render(
      <MergeConflictViewer
        currentJson={current}
        incomingJson={incoming}
        hideToolbar
        hideStatus
      />,
    )
    expect(screen.queryByText("Apply all from current")).toBeNull()
    expect(screen.queryByRole("status")).toBeNull()
  })

  it("accepts a custom toolbar", () => {
    render(
      <MergeConflictViewer
        currentJson={current}
        incomingJson={incoming}
        renderToolbar={(state) => (
          <button type="button" onClick={() => state.applyAll("left")}>
            take mine ({state.status.unresolved})
          </button>
        )}
      />,
    )
    fireEvent.click(screen.getByText("take mine (4)"))
    expect(screen.getByRole("status").textContent).toContain("Safe to merge")
  })

  it("applies height and maxHeight to the root", () => {
    const { container } = render(
      <MergeConflictViewer
        currentJson={current}
        incomingJson={incoming}
        height="100%"
        maxHeight={400}
        className="mine"
      />,
    )
    const root = container.firstElementChild as HTMLElement
    expect(root.style.height).toBe("100%")
    expect(root.style.maxHeight).toBe("400px")
    expect(root.classList.contains("mcv-root")).toBe(true)
    expect(root.classList.contains("mine")).toBe(true)
  })
})

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
})
