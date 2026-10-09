import {
  type CSSProperties,
  type KeyboardEvent,
  type UIEvent,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { type DisplayItem, foldRows } from "./folding"
import { type InlineSegment, inlineSegments } from "./inline-diff"
import {
  type MergeViewerLabels,
  type ResolvedLabels,
  resolveLabels,
} from "./labels"
import {
  buildMergeLayout,
  type Choice,
  type ConflictKind,
  type MergeBlock,
  type MergeRow,
  type MergeStatus,
  resolveConflict,
} from "./merge-model"
import {
  type GridLayout,
  gridTemplateColumns,
  type MergeColumn,
  type MergePane,
  placeCell,
} from "./placement"
import type { JsonObject, SideSelection } from "./types/index"
import {
  type MergeConflictsState,
  type UseMergeConflictsOptions,
  useMergeConflicts,
} from "./use-merge-conflicts"

/** Below this container width the "responsive" layout stacks the panes. */
const DEFAULT_STACK_BELOW_PX = 900

/** Unchanged lines kept around each change when unchanged lines are folded. */
const DEFAULT_FOLD_CONTEXT = 3

const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect

export type MergeViewerLayout = "horizontal" | "vertical" | "responsive"

/**
 * How a cell should look.
 * - `unchanged`: not part of a change
 * - `changed`: part of a change that this pane takes part in
 * - `pending`: a result nobody has decided on yet
 * - `edited`: a result typed by hand
 * - `rejected`: a side that was not chosen
 * - `filler`: nothing on this side (render hatched space)
 */
export type MergeCellState =
  | "unchanged"
  | "changed"
  | "pending"
  | "edited"
  | "rejected"
  | "filler"

/** A button that acts on one change. */
export interface MergeViewerAction {
  /** Visible tooltip and accessible name. */
  label: string
  /** Whether this is the decision currently in the result. */
  pressed: boolean
  run: () => void
}

export interface MergeViewerLine {
  pane: MergePane
  /** The JSON text of this line, or `null` when there is nothing here. */
  text: string | null
  /** The text split for highlighting the characters that differ. */
  segments: InlineSegment[]
  lineNo: number | null
  state: MergeCellState
  /** `null` for lines that are not part of a change. */
  kind: ConflictKind | null
  blockId: string | null
  blockStart: boolean
  blockEnd: boolean
  /** The change last navigated to or decided on. */
  active: boolean
  /** Buttons for this change; only present on the first line of a block. */
  actions: {
    accept?: MergeViewerAction
    remove?: MergeViewerAction
    edit?: MergeViewerAction
    revert?: MergeViewerAction
  }
  /** Set on the result line of the change being edited. */
  editor?: {
    title: string
    inputLabel: string
    initialText: string
  }
}

export interface MergeViewerRow {
  type: "row"
  /** Stable React key. */
  key: string
  /** Position among the displayed items. */
  index: number
  row: MergeRow
  current: MergeViewerLine
  result: MergeViewerLine
  incoming: MergeViewerLine
}

export interface MergeViewerFold {
  type: "fold"
  key: string
  index: number
  /** Number of hidden lines. */
  hidden: number
  /** "120 unchanged lines" */
  label: string
  /** "Show 120 unchanged lines" */
  showLabel: string
  expand: () => void
}

export type MergeViewerItem = MergeViewerRow | MergeViewerFold

export type MergeViewerStatusState = "empty" | "pending" | "resolved"

export interface UseMergeViewerOptions extends UseMergeConflictsOptions {
  /**
   * Called on mount and whenever the result or its resolution status changes.
   * `status.allResolved` is `true` once every change has been decided.
   */
  onMergeChange?: (mergedJson: JsonObject, status: MergeStatus) => void
  /** Lets users write the value of a change by hand. Defaults to `false`. */
  editable?: boolean
  /** Every text the viewer shows. Override what you need. */
  labels?: MergeViewerLabels
  /**
   * - "horizontal": always side by side (Current | Result | Incoming)
   * - "vertical": always stacked (Current, Incoming, then Result)
   * - "responsive": horizontal when there is room, stacked otherwise (default)
   */
  layout?: MergeViewerLayout
  /** Container width below which "responsive" stacks the panes. Default 900. */
  stackBelow?: number
  /**
   * Folds long runs of unchanged lines. `true` keeps 3 lines of context around
   * each change, a number sets the amount. Defaults to `false`.
   */
  collapseUnchanged?: boolean | number
  /**
   * Whether long lines wrap (the default). Turn it off and every line stays on
   * one row: the three panes then scroll sideways together, driven by the
   * scrollbar from `getScrollbarProps`. Users can flip it with
   * `toggleWrapLines`; changing this option sets it again.
   */
  wrapLines?: boolean
}

/**
 * The CSS variable (a length) that holds how far the lines are scrolled
 * sideways while they do not wrap. It is set on the root element.
 */
export const SCROLL_X_VARIABLE = "--merge-scroll-x"

interface CellProps {
  style: CSSProperties
  "data-pane": MergePane
  "data-column": MergeColumn
  "data-state": MergeCellState
  "data-kind"?: ConflictKind
  "data-block-start"?: ""
  "data-block-end"?: ""
  "data-active"?: ""
  "data-merge-block"?: string
  /** Only on `code` cells. */
  "data-wrap"?: "wrap" | "nowrap"
}

export interface MergeViewer extends MergeConflictsState {
  /** Everything shown, in order: lines and folds of unchanged lines. */
  items: MergeViewerItem[]
  labels: ResolvedLabels
  /** `true` when the panes are stacked (Current, Incoming, Result). */
  stacked: boolean
  statusState: MergeViewerStatusState
  /** The banner text matching `statusState`. */
  statusText: string

  // Folding
  /**
   * Whether long runs of unchanged lines are folded. `false` as soon as one
   * of them was opened by hand, so a "hide" button reads as not pressed.
   */
  collapsed: boolean
  /**
   * Hides every unchanged run when some are showing (including ones opened by
   * hand), otherwise switches folding off again.
   */
  toggleCollapsed: () => void

  // Line wrapping
  /** `true` while long lines wrap; `false` while they scroll sideways. */
  wrapLines: boolean
  setWrapLines: (wrap: boolean) => void
  toggleWrapLines: () => void

  // Navigation
  activeId: string | null
  /** Scrolls to the next or previous change and marks it active. */
  goToChange: (direction: "next" | "previous") => void
  /** Scrolls to the next undecided change. Returns `false` if none is left. */
  goToNextUnresolved: () => boolean

  // Editing
  editable: boolean
  editingId: string | null
  startEdit: (id: string) => void
  cancelEdit: () => void
  /** The change's current value as pretty-printed JSON. */
  editorText: (id: string) => string
  /**
   * Parses `text` and uses it as the value of the change. Returns the parser's
   * message when the text is not valid JSON (and changes nothing).
   */
  commitEdit: (id: string, text: string) => string | null

  // Prop getters: spread them on your elements
  getRootProps: () => {
    ref: (element: HTMLElement | null) => void
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => void
    "data-merge-status": MergeViewerStatusState
  }
  getScrollProps: () => { ref: (element: HTMLElement | null) => void }
  getGridProps: () => {
    style: CSSProperties
    "data-layout": GridLayout
  }
  /**
   * Wrap the text of every line in an element with these props. While lines do
   * not wrap, it is what slides sideways. Harmless while they wrap.
   */
  getTextProps: () => {
    style: CSSProperties
    "data-merge-text": ""
  }
  /**
   * A horizontal scrollbar for the lines, to render inside the scroll element
   * after the grid. It is `hidden` while lines wrap or fit. Put the props of
   * `getScrollbarContentProps` on its only child.
   */
  getScrollbarProps: () => {
    ref: (element: HTMLElement | null) => void
    hidden: boolean
    role: "group"
    tabIndex: 0
    "aria-label": string
    "data-merge-scrollbar": ""
    style: CSSProperties
    onScroll: (event: UIEvent<HTMLElement>) => void
  }
  getScrollbarContentProps: () => { style: CSSProperties }
  getHeaderProps: (pane: MergePane) => {
    style: CSSProperties
    "data-pane": MergePane
    "data-column": "header"
  }
  getCellProps: (
    item: MergeViewerRow,
    pane: MergePane,
    column: Exclude<MergeColumn, "header" | "fold">,
  ) => CellProps
  getFoldProps: (
    item: MergeViewerFold,
    pane: MergePane,
  ) => {
    type: "button"
    style: CSSProperties
    tabIndex: number
    "aria-hidden"?: true
    "aria-label": string
    "data-pane": MergePane
    "data-column": "fold"
    onClick: () => void
  }
}

const flag = (value: boolean): "" | undefined => (value ? "" : undefined)

export function useMergeViewer({
  onMergeChange,
  editable = false,
  labels,
  layout = "responsive",
  stackBelow = DEFAULT_STACK_BELOW_PX,
  collapseUnchanged = false,
  wrapLines: wrapLinesOption = true,
  ...mergeOptions
}: UseMergeViewerOptions): MergeViewer {
  const t = useMemo(() => resolveLabels(labels), [labels])
  const state = useMergeConflicts(mergeOptions)
  const { tree, selection, merged, status, isResolved } = state

  const mergeLayout = useMemo(
    () => buildMergeLayout(tree, selection),
    [tree, selection],
  )

  const blockById = useMemo(() => {
    const map = new Map<string, MergeBlock>()
    for (const block of mergeLayout.blocks) {
      map.set(block.id, block)
    }
    return map
  }, [mergeLayout])

  const onMergeChangeRef = useRef(onMergeChange)
  onMergeChangeRef.current = onMergeChange

  useEffect(() => {
    onMergeChangeRef.current?.(merged, status)
  }, [merged, status])

  // ---- Elements -----------------------------------------------------------

  const [rootElement, setRootElement] = useState<HTMLElement | null>(null)
  const [scrollElement, setScrollElement] = useState<HTMLElement | null>(null)

  // ---- Layout mode --------------------------------------------------------

  const [narrow, setNarrow] = useState(false)

  useIsomorphicLayoutEffect(() => {
    if (
      layout !== "responsive" ||
      !scrollElement ||
      typeof ResizeObserver === "undefined"
    ) {
      return
    }

    const observer = new ResizeObserver(([entry]) => {
      setNarrow(entry.contentRect.width < stackBelow)
    })
    observer.observe(scrollElement)
    return () => observer.disconnect()
  }, [layout, scrollElement, stackBelow])

  const stacked = layout === "vertical" || (layout === "responsive" && narrow)
  const gridLayout: GridLayout = stacked ? "stacked" : "horizontal"

  // ---- Folding unchanged lines -------------------------------------------

  const foldContext =
    typeof collapseUnchanged === "number"
      ? collapseUnchanged
      : DEFAULT_FOLD_CONTEXT
  const [foldingOn, setFoldingOn] = useState(collapseUnchanged !== false)
  const [expandedFolds, setExpandedFolds] = useState<ReadonlySet<string>>(
    () => new Set(),
  )

  const displayItems = useMemo<DisplayItem[]>(
    () =>
      foldingOn
        ? foldRows(mergeLayout.rows, foldContext, expandedFolds)
        : mergeLayout.rows.map((row) => ({ type: "row", row })),
    [foldingOn, mergeLayout, foldContext, expandedFolds],
  )

  // Folding is only "on" for the user while nothing was opened by hand:
  // compare the folds showing with the folds there would be with none opened.
  const foldCount = (items: readonly DisplayItem[]): number =>
    items.filter((item) => item.type === "fold").length
  const collapsed = useMemo(
    () =>
      foldingOn &&
      foldCount(displayItems) ===
        foldCount(foldRows(mergeLayout.rows, foldContext, new Set())),
    [foldingOn, displayItems, mergeLayout, foldContext],
  )

  const toggleCollapsed = (): void => {
    setExpandedFolds(new Set())
    // Switch folding off only when everything is folded. If a run was opened
    // by hand, fold them all again: switching off would change nothing visible
    // and the button would look broken.
    setFoldingOn(!collapsed)
  }

  const expandFold = (key: string): void => {
    setExpandedFolds((prev) => new Set(prev).add(key))
  }

  // ---- Line wrapping ------------------------------------------------------

  const [wrapLines, setWrapLines] = useState(wrapLinesOption)
  // The option is where wrapping starts; a new value sets it again.
  useEffect(() => setWrapLines(wrapLinesOption), [wrapLinesOption])
  const toggleWrapLines = (): void => setWrapLines((wrap) => !wrap)

  // While lines do not wrap, the text of every pane slides by the same amount
  // (the `--merge-scroll-x` variable on the root), so the panes stay in step.
  // That amount comes from a scrollbar of our own, as the lines themselves
  // sit in one grid and cannot each scroll. `scrollRange` is how far the
  // widest line reaches past the narrowest pane.
  const [scrollbarElement, setScrollbarElement] = useState<HTMLElement | null>(
    null,
  )
  const [scrollRange, setScrollRange] = useState(0)
  const scrollable = !wrapLines && scrollRange > 0

  useIsomorphicLayoutEffect(() => {
    if (wrapLines || !rootElement) {
      setScrollRange(0)
      return
    }

    const measure = (): void => {
      let widest = 0
      for (const text of rootElement.querySelectorAll<HTMLElement>(
        "[data-merge-text]",
      )) {
        widest = Math.max(widest, text.offsetWidth)
      }
      // Cells that are not displayed (empty ones when stacked) measure 0.
      let narrowest: HTMLElement | null = null
      for (const cell of rootElement.querySelectorAll<HTMLElement>(
        '[data-column="code"]',
      )) {
        if (
          cell.clientWidth > 0 &&
          (narrowest === null || cell.clientWidth < narrowest.clientWidth)
        ) {
          narrowest = cell
        }
      }
      if (!narrowest) {
        setScrollRange(0)
        return
      }
      const style = getComputedStyle(narrowest)
      const padding =
        (Number.parseFloat(style.paddingLeft) || 0) +
        (Number.parseFloat(style.paddingRight) || 0)
      setScrollRange(
        Math.max(0, Math.ceil(widest + padding - narrowest.clientWidth)),
      )
    }

    measure()
    if (!scrollElement || typeof ResizeObserver === "undefined") {
      return
    }
    const observer = new ResizeObserver(measure)
    observer.observe(scrollElement)
    return () => observer.disconnect()
    // `displayItems` stands for the text of the lines.
  }, [wrapLines, rootElement, scrollElement, displayItems, stacked])

  useIsomorphicLayoutEffect(() => {
    rootElement?.style.setProperty(
      SCROLL_X_VARIABLE,
      `${scrollable && scrollbarElement ? scrollbarElement.scrollLeft : 0}px`,
    )
  }, [rootElement, scrollbarElement, scrollable])

  // Sideways wheel and trackpad gestures (and Shift + wheel) over the lines
  // move the scrollbar, and with it every pane.
  useEffect(() => {
    if (!scrollable || !scrollElement || !scrollbarElement) {
      return
    }
    const onWheel = (event: WheelEvent): void => {
      const delta = event.shiftKey
        ? event.deltaX || event.deltaY
        : Math.abs(event.deltaX) > Math.abs(event.deltaY)
          ? event.deltaX
          : 0
      if (delta === 0) {
        return
      }
      const before = scrollbarElement.scrollLeft
      scrollbarElement.scrollLeft += delta
      if (scrollbarElement.scrollLeft !== before) {
        event.preventDefault()
      }
    }
    scrollElement.addEventListener("wheel", onWheel, { passive: false })
    return () => scrollElement.removeEventListener("wheel", onWheel)
  }, [scrollable, scrollElement, scrollbarElement])

  // ---- Navigation ---------------------------------------------------------

  const [activeId, setActiveId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  const order = useMemo(() => tree.conflicts.map((c) => c.id), [tree])

  const scrollToBlock = (id: string): void => {
    const nodes = Array.from(
      rootElement?.querySelectorAll<HTMLElement>("[data-merge-block]") ?? [],
    ).filter((node) => node.dataset.mergeBlock === id)
    // Filler cells are hidden when the panes are stacked.
    const target =
      nodes.find((node) => getComputedStyle(node).display !== "none") ??
      nodes[0]
    const reduceMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
    target?.scrollIntoView?.({
      block: "center",
      behavior: reduceMotion ? "auto" : "smooth",
    })
  }

  const jumpTo = (id: string): void => {
    setActiveId(id)
    scrollToBlock(id)
  }

  const pick = (
    candidates: string[],
    direction: "next" | "previous",
  ): string | null => {
    if (candidates.length === 0) {
      return null
    }
    const position = activeId === null ? -1 : order.indexOf(activeId)
    if (direction === "next") {
      return (
        candidates.find((id) => order.indexOf(id) > position) ?? candidates[0]
      )
    }
    const before = position === -1 ? order.length : position
    return (
      [...candidates].reverse().find((id) => order.indexOf(id) < before) ??
      candidates[candidates.length - 1]
    )
  }

  const goToNextUnresolved = (): boolean => {
    const id = pick(
      order.filter((candidate) => !isResolved(candidate)),
      "next",
    )
    if (id === null) {
      return false
    }
    jumpTo(id)
    return true
  }

  const goToChange = (direction: "next" | "previous"): void => {
    const id = pick(order, direction)
    if (id !== null) {
      jumpTo(id)
    }
  }

  // ---- Actions ------------------------------------------------------------

  const choose = (id: string, choice: Choice): void => {
    state.choose(id, choice)
    setActiveId(id)
  }

  const editorText = (id: string): string => {
    const block = blockById.get(id)
    if (!block) {
      return "null"
    }
    const resolved = resolveConflict(block.entry, selection[id])
    const value = resolved.present
      ? resolved.value
      : block.entry.hasRight
        ? block.entry.right
        : block.entry.left
    return JSON.stringify(value, null, 2) ?? "null"
  }

  const startEdit = (id: string): void => {
    setActiveId(id)
    setEditingId(id)
  }

  const cancelEdit = (): void => setEditingId(null)

  const commitEdit = (id: string, text: string): string | null => {
    let value: unknown
    try {
      value = JSON.parse(text)
    } catch (cause) {
      return cause instanceof Error ? cause.message : "Invalid JSON"
    }
    choose(id, { custom: value })
    setEditingId(null)
    return null
  }

  // ---- Render model -------------------------------------------------------

  const buildLine = (
    pane: MergePane,
    row: MergeRow,
    text: string | null,
    lineNo: number | null,
    other: string | null,
  ): MergeViewerLine => {
    const block = row.blockId ? blockById.get(row.blockId) : undefined
    const blockStart = Boolean(block) && row.blockRow === 0
    const blockEnd = Boolean(block) && row.blockRow === row.blockSize - 1
    const resolved = block ? isResolved(block.id) : true
    const entry = block?.entry

    const accepted =
      pane === "current"
        ? block?.selection === "left"
        : pane === "incoming"
          ? block?.selection === "right"
          : true

    let cellState: MergeCellState = "unchanged"
    if (block) {
      if (text === null) {
        cellState = "filler"
      } else if (pane === "result" && !resolved) {
        cellState = "pending"
      } else if (pane === "result" && block.selection === "custom") {
        cellState = "edited"
      } else if (resolved && !accepted) {
        cellState = "rejected"
      } else {
        cellState = "changed"
      }
    }

    const actions: MergeViewerLine["actions"] = {}
    if (block && entry && blockStart) {
      const remove = (): MergeViewerAction => ({
        label: t.removeChange(entry.label),
        pressed: resolved && block.selection === "deleted",
        run: () => choose(block.id, "deleted"),
      })
      const accept = (
        side: SideSelection,
        label: string,
      ): MergeViewerAction => ({
        label,
        pressed: resolved && block.selection === side,
        run: () => choose(block.id, side),
      })

      if (pane === "current" && entry.hasLeft) {
        actions.remove = remove()
        actions.accept = accept("left", t.acceptCurrent(entry.label))
      } else if (pane === "incoming" && entry.hasRight) {
        actions.accept = accept("right", t.acceptIncoming(entry.label))
        actions.remove = remove()
      } else if (pane === "result" && editable) {
        if (block.selection === "custom") {
          actions.revert = {
            label: t.revertEdit(entry.label),
            pressed: false,
            run: () => state.revert(block.id),
          }
        }
        actions.edit = {
          label: t.editChange(entry.label),
          pressed: false,
          run: () => startEdit(block.id),
        }
      }
    }

    const editing =
      pane === "result" &&
      editable &&
      blockStart &&
      block !== undefined &&
      editingId === block.id

    return {
      pane,
      text,
      segments:
        text === null
          ? []
          : inlineSegments(
              text,
              pane !== "result" && block?.kind === "modified"
                ? other
                : undefined,
            ),
      lineNo,
      state: cellState,
      kind: block?.kind ?? null,
      blockId: block?.id ?? null,
      blockStart,
      blockEnd,
      active: Boolean(block) && activeId === block?.id,
      actions,
      editor:
        editing && block && entry
          ? {
              title: t.editorTitle(entry.label),
              inputLabel: t.editorInput(entry.label),
              initialText: editorText(block.id),
            }
          : undefined,
    }
  }

  const items: MergeViewerItem[] = displayItems.map((item, index) => {
    if (item.type === "fold") {
      return {
        type: "fold",
        key: `fold-${item.key}`,
        index,
        hidden: item.hidden,
        label: t.unchangedLines(item.hidden),
        showLabel: t.showUnchanged(item.hidden),
        expand: () => expandFold(item.key),
      }
    }

    const { row } = item
    return {
      type: "row",
      key: `row-${row.index}`,
      index,
      row,
      current: buildLine("current", row, row.left, row.leftNo, row.right),
      result: buildLine("result", row, row.result, row.resultNo, null),
      incoming: buildLine("incoming", row, row.right, row.rightNo, row.left),
    }
  })

  const total = status.total
  const statusState: MergeViewerStatusState =
    total === 0 ? "empty" : status.allResolved ? "resolved" : "pending"
  const statusText =
    total === 0
      ? t.noChanges
      : status.allResolved
        ? t.allResolved(status)
        : t.unresolved(status)

  // ---- Prop getters -------------------------------------------------------

  const onKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    const target = event.target as HTMLElement
    if (
      !(event.ctrlKey || event.metaKey) ||
      target.closest("textarea, input")
    ) {
      return
    }
    const key = event.key.toLowerCase()
    if (key === "z" && !event.shiftKey) {
      event.preventDefault()
      state.undo()
    } else if ((key === "z" && event.shiftKey) || key === "y") {
      event.preventDefault()
      state.redo()
    }
  }

  const rowCount = items.length

  return {
    ...state,
    choose,
    items,
    labels: t,
    stacked,
    statusState,
    statusText,

    collapsed,
    toggleCollapsed,

    wrapLines,
    setWrapLines,
    toggleWrapLines,

    activeId,
    goToChange,
    goToNextUnresolved,

    editable,
    editingId,
    startEdit,
    cancelEdit,
    editorText,
    commitEdit,

    getRootProps: () => ({
      ref: setRootElement,
      onKeyDown,
      "data-merge-status": statusState,
    }),
    getScrollProps: () => ({ ref: setScrollElement }),
    getGridProps: () => ({
      style: {
        display: "grid",
        gridTemplateColumns: gridTemplateColumns(gridLayout),
      },
      "data-layout": gridLayout,
    }),
    getTextProps: () => ({
      style: wrapLines
        ? {}
        : {
            display: "block",
            width: "max-content",
            transform: `translateX(calc(var(${SCROLL_X_VARIABLE}, 0px) * -1))`,
          },
      "data-merge-text": "",
    }),
    getScrollbarProps: () => ({
      ref: setScrollbarElement,
      hidden: !scrollable,
      role: "group",
      tabIndex: 0,
      "aria-label": t.scrollLines,
      "data-merge-scrollbar": "",
      style: {
        position: "sticky",
        bottom: 0,
        overflowX: "auto",
        overflowY: "hidden",
      },
      onScroll: (event) => {
        rootElement?.style.setProperty(
          SCROLL_X_VARIABLE,
          `${event.currentTarget.scrollLeft}px`,
        )
      },
    }),
    getScrollbarContentProps: () => ({
      style: { width: `calc(100% + ${scrollRange}px)`, height: 1 },
    }),
    getHeaderProps: (pane) => ({
      style: { ...placeCell(gridLayout, pane, "header", 0, rowCount) },
      "data-pane": pane,
      "data-column": "header",
    }),
    getCellProps: (item, pane, column) => {
      const line = item[pane]
      const style: CSSProperties = {
        ...placeCell(gridLayout, pane, column, item.index, rowCount),
      }
      if (column === "code") {
        style.minWidth = 0
        if (wrapLines) {
          style.whiteSpace = "pre-wrap"
          style.overflowWrap = "anywhere"
        } else {
          // `clip` hides what slid out without making the cell scroll, so
          // buttons and popovers inside it keep their place.
          style.whiteSpace = "pre"
          style.overflowX = "clip"
        }
      }
      // Empty cells would only add blank rows when the panes are stacked.
      if (stacked && line.state === "filler") {
        style.display = "none"
      }
      return {
        style,
        "data-pane": pane,
        "data-column": column,
        "data-state": line.state,
        "data-kind": line.kind ?? undefined,
        "data-block-start": flag(line.blockStart),
        "data-block-end": flag(line.blockEnd),
        "data-active": flag(line.active),
        "data-wrap":
          column === "code" ? (wrapLines ? "wrap" : "nowrap") : undefined,
        "data-merge-block":
          column === "code" && line.blockStart
            ? (line.blockId ?? undefined)
            : undefined,
      }
    },
    getFoldProps: (item, pane) => ({
      type: "button",
      style: { ...placeCell(gridLayout, pane, "fold", item.index, rowCount) },
      // Only one of the three panes needs to be reachable and announced.
      tabIndex: pane === "current" ? 0 : -1,
      "aria-hidden": pane === "current" ? undefined : true,
      "aria-label": item.showLabel,
      "data-pane": pane,
      "data-column": "fold",
      onClick: item.expand,
    }),
  }
}
