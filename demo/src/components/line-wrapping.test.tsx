import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { MergeConflictViewer } from "@/components/ui/merge-conflict-viewer"

const current = { a: 1, b: { c: 2 }, only: "left", same: true }
const incoming = { a: 2, b: { c: 3 }, extra: "right", same: true }

const offsetWidth = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "offsetWidth",
)
const clientWidth = Object.getOwnPropertyDescriptor(
  Element.prototype,
  "clientWidth",
)

afterEach(() => {
  cleanup()
  if (offsetWidth) {
    Object.defineProperty(HTMLElement.prototype, "offsetWidth", offsetWidth)
  }
  if (clientWidth) {
    Object.defineProperty(Element.prototype, "clientWidth", clientWidth)
  }
})

/** jsdom has no layout: say every line is 600px wide in a 200px cell. */
function fakeLayout() {
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
    configurable: true,
    get(this: HTMLElement) {
      return this.matches("[data-merge-text]") ? 600 : 0
    },
  })
  Object.defineProperty(Element.prototype, "clientWidth", {
    configurable: true,
    get(this: Element) {
      return this.matches('[data-column="code"]') ? 200 : 0
    },
  })
}

const wrapButton = () => screen.getByRole("button", { name: "Wrap lines" })
const codeCells = () =>
  Array.from(document.querySelectorAll<HTMLElement>('[data-column="code"]'))
const scrollbar = () => {
  const bar = document.querySelector<HTMLElement>("[data-merge-scrollbar]")
  if (!bar) {
    throw new Error("no scrollbar")
  }
  return bar
}
const rootElement = () => {
  const root = document.querySelector<HTMLElement>(
    '[data-slot="merge-conflict-viewer"]',
  )
  if (!root) {
    throw new Error("no root")
  }
  return root
}
const scrollX = () => rootElement().style.getPropertyValue("--merge-scroll-x")

describe("line wrapping", () => {
  it("wraps by default and the toolbar toggles it", () => {
    render(
      <MergeConflictViewer currentJson={current} incomingJson={incoming} />,
    )

    expect(wrapButton().getAttribute("aria-pressed")).toBe("true")
    expect(codeCells().every((c) => c.dataset.wrap === "wrap")).toBe(true)

    fireEvent.click(wrapButton())
    expect(wrapButton().getAttribute("aria-pressed")).toBe("false")
    expect(codeCells().every((c) => c.dataset.wrap === "nowrap")).toBe(true)
    expect(codeCells()[0].style.whiteSpace).toBe("pre")

    fireEvent.click(wrapButton())
    expect(codeCells().every((c) => c.dataset.wrap === "wrap")).toBe(true)
  })

  it("can start without wrapping", () => {
    render(
      <MergeConflictViewer
        currentJson={current}
        incomingJson={incoming}
        wrapLines={false}
      />,
    )
    expect(wrapButton().getAttribute("aria-pressed")).toBe("false")
    expect(codeCells().every((c) => c.dataset.wrap === "nowrap")).toBe(true)
  })

  it("clips cells instead of scrolling them, so their buttons stay put", () => {
    render(
      <MergeConflictViewer
        currentJson={current}
        incomingJson={incoming}
        wrapLines={false}
        editable
      />,
    )
    expect(codeCells()[0].style.overflowX).toBe("clip")
    expect(screen.getByLabelText("Edit a in result")).not.toBeNull()
  })

  it("shows one scrollbar that moves every pane when lines are wider than their pane", () => {
    fakeLayout()
    render(
      <MergeConflictViewer
        currentJson={current}
        incomingJson={incoming}
        wrapLines={false}
      />,
    )

    const bar = scrollbar()
    expect(bar.hidden).toBe(false)
    // 600px of text in a 200px cell (no padding in jsdom): 400px to scroll.
    expect((bar.firstElementChild as HTMLElement).style.width).toBe(
      "calc(100% + 400px)",
    )
    expect(scrollX()).toBe("0px")

    bar.scrollLeft = 120
    fireEvent.scroll(bar)
    // One variable on the root feeds the text of all three panes.
    expect(scrollX()).toBe("120px")
    const texts = document.querySelectorAll<HTMLElement>("[data-merge-text]")
    expect(texts.length).toBeGreaterThan(0)
    for (const text of texts) {
      expect(text.style.transform).toContain("var(--merge-scroll-x")
    }

    // Wrapping again hides the scrollbar and puts the text back.
    fireEvent.click(wrapButton())
    expect(scrollbar().hidden).toBe(true)
    expect(scrollX()).toBe("0px")
    expect(
      document.querySelector<HTMLElement>("[data-merge-text]")?.style.transform,
    ).toBe("")
  })

  it("moves the scrollbar with Shift + wheel over the lines", () => {
    fakeLayout()
    render(
      <MergeConflictViewer
        currentJson={current}
        incomingJson={incoming}
        wrapLines={false}
      />,
    )
    const panes = document.querySelector<HTMLElement>(
      '[data-slot="merge-conflict-panes"]',
    )
    if (!panes) {
      throw new Error("no panes")
    }
    const bar = scrollbar()

    // jsdom does not clamp scrollLeft, which is enough to see the wiring.
    fireEvent.wheel(panes, { deltaY: 50, shiftKey: true })
    expect(bar.scrollLeft).toBe(50)
    // A plain vertical wheel is left to the browser.
    fireEvent.wheel(panes, { deltaY: 50 })
    expect(bar.scrollLeft).toBe(50)
  })
})
