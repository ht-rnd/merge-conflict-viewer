import { useMergeViewer } from "@ht-rnd/merge-conflict-viewer"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  MergeConflictPanes,
  MergeConflictStatus,
  MergeConflictViewer,
} from "@/components/ui/merge-conflict-viewer"

const current = { a: 1, b: { c: 2 }, only: "left", same: true }
const incoming = { a: 2, b: { c: 3 }, extra: "right", same: true }

afterEach(() => {
  cleanup()
})

const lastCall = (fn: ReturnType<typeof vi.fn>) =>
  fn.mock.calls[fn.mock.calls.length - 1]

const statusText = () => screen.getByRole("status").textContent

describe("MergeConflictViewer", () => {
  it("starts unresolved and reports it", () => {
    const onMergeChange = vi.fn()
    render(
      <MergeConflictViewer
        currentJson={current}
        incomingJson={incoming}
        onMergeChange={onMergeChange}
      />,
    )

    expect(statusText()).toBe("4 of 4 changes still need a decision.")
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
    expect(statusText()).toBe("1 of 4 changes still needs a decision.")
    expect(screen.queryByText("Next unresolved")).not.toBeNull()

    fireEvent.click(screen.getByLabelText("Accept incoming extra"))
    expect(statusText()).toBe("All 4 changes resolved. Safe to merge.")
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
    expect(statusText()).toContain("Safe to merge")
  })

  it("lets the host override the status messages", () => {
    render(
      <MergeConflictViewer
        currentJson={{ a: 1 }}
        incomingJson={{ a: 1 }}
        labels={{ noChanges: "Identical" }}
      />,
    )
    expect(statusText()).toBe("Identical")
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
    expect(statusText()).toBe("4 offen")
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
    // shadcn's Progress slides its indicator: translateX(-(100 - value)%).
    const progress = () => {
      const transform = (
        container.querySelector("[data-slot=progress-indicator]") as HTMLElement
      ).style.transform
      return (
        100 -
        Math.abs(Number.parseFloat(/-?[\d.]+/.exec(transform)?.[0] ?? "0"))
      )
    }
    expect(root.dataset.mergeStatus).toBe("pending")
    expect(progress()).toBe(0)

    fireEvent.click(screen.getByLabelText("Accept current a"))
    expect(progress()).toBe(25)

    fireEvent.click(screen.getByText("Apply all from incoming"))
    expect(root.dataset.mergeStatus).toBe("resolved")
    expect(progress()).toBe(100)
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
    expect(statusText()).toContain("3 of 4")
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
    expect(statusText()).toContain("4 of 4")

    rerender(
      <MergeConflictViewer
        currentJson={current}
        incomingJson={incoming}
        decisions={{ '["a"]': "left" }}
        onDecisionsChange={onDecisionsChange}
      />,
    )
    expect(statusText()).toContain("3 of 4")
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

  it("folds again from the button after a fold was opened by hand", () => {
    const wide = Object.fromEntries(
      Array.from({ length: 40 }, (_, i) => [`key${i}`, i]),
    )
    render(
      <MergeConflictViewer
        currentJson={wide}
        incomingJson={{ ...wide, key2: "changed" }}
        collapseUnchanged={1}
      />,
    )
    const foldLabel = /^Show \d+ unchanged lines$/
    const button = screen.getByRole("button", { name: "Hide unchanged lines" })
    expect(button.getAttribute("aria-pressed")).toBe("true")

    // The only fold, opened by clicking the "N unchanged lines" text.
    fireEvent.click(screen.getAllByLabelText(foldLabel)[0])
    expect(screen.queryAllByLabelText(foldLabel)).toHaveLength(0)
    expect(button.getAttribute("aria-pressed")).toBe("false")

    // One press hides it again, the next shows everything.
    fireEvent.click(button)
    expect(screen.getAllByLabelText(foldLabel).length).toBeGreaterThan(0)
    expect(button.getAttribute("aria-pressed")).toBe("true")
    fireEvent.click(button)
    expect(screen.queryAllByLabelText(foldLabel)).toHaveLength(0)
    expect(button.getAttribute("aria-pressed")).toBe("false")
  })

  it("keeps panes aligned by placing every cell on the grid", () => {
    const { container } = render(
      <MergeConflictViewer currentJson={current} incomingJson={incoming} />,
    )
    const cells = container.querySelectorAll<HTMLElement>(
      "[data-pane][data-column]",
    )
    expect(cells.length).toBeGreaterThan(0)
    for (const cell of cells) {
      expect(cell.style.gridRow).not.toBe("")
      expect(cell.style.gridColumn).not.toBe("")
    }
  })

  it("exposes the state of every cell for your own styling", () => {
    const { container } = render(
      <MergeConflictViewer currentJson={current} incomingJson={incoming} />,
    )
    const pending = container.querySelector(
      '[data-pane="result"][data-column="code"][data-state="pending"]',
    )
    expect(pending).not.toBeNull()

    fireEvent.click(screen.getByLabelText("Accept current a"))
    expect(
      container.querySelector(
        '[data-pane="incoming"][data-column="code"][data-state="rejected"]',
      ),
    ).not.toBeNull()
  })
})

describe("composition and viewer prop", () => {
  it("renders only the parts it is given", () => {
    render(
      <MergeConflictViewer currentJson={current} incomingJson={incoming}>
        <MergeConflictStatus />
        <MergeConflictPanes />
      </MergeConflictViewer>,
    )
    expect(screen.queryByText("Apply all from current")).toBeNull()
    expect(screen.queryByLabelText("Undo")).toBeNull()
    expect(screen.queryByRole("status")).not.toBeNull()
    expect(screen.queryByLabelText("Accept current a")).not.toBeNull()
  })

  it("applies className and style to the root", () => {
    const { container } = render(
      <MergeConflictViewer
        currentJson={current}
        incomingJson={incoming}
        className="mine h-[400px]"
        style={{ maxHeight: 400 }}
      />,
    )
    const root = container.firstElementChild as HTMLElement
    expect(root.classList.contains("mine")).toBe(true)
    expect(root.classList.contains("h-[400px]")).toBe(true)
    expect(root.style.maxHeight).toBe("400px")
  })

  it("can be driven by a viewer created with the hook", () => {
    let latest: ReturnType<typeof useMergeViewer> | undefined
    function Page() {
      const viewer = useMergeViewer({
        currentJson: current,
        incomingJson: incoming,
      })
      latest = viewer
      return <MergeConflictViewer viewer={viewer} />
    }
    render(<Page />)

    expect(latest?.status.allResolved).toBe(false)
    act(() => latest?.applyAll("left"))
    expect(latest?.merged).toEqual(current)
    expect(statusText()).toContain("Safe to merge")

    act(() => latest?.reset())
    expect(latest?.goToNextUnresolved()).toBe(true)

    act(() => latest?.undo())
    expect(latest?.status.allResolved).toBe(true)
  })
})
