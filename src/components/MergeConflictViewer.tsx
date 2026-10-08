import clsx from "clsx"
import {
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  ChevronUp,
  CircleAlert,
  CircleCheck,
  Info,
  Pencil,
  Redo2,
  Undo2,
  X,
} from "lucide-react"
import {
  type CSSProperties,
  forwardRef,
  type JSX,
  type ReactNode,
  useEffect,
  useImperativeHandle,
  useInsertionEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { type DisplayItem, foldRows } from "../lib/folding"
import {
  buildMergeLayout,
  type MergeBlock,
  type MergeRow,
  type MergeStatus,
  resolveConflict,
  type Selection,
} from "../lib/merge-model"
import type { DiffSide, JsonObject, SideSelection } from "../lib/types"
import {
  type MergeConflictsState,
  useMergeConflicts,
} from "../lib/use-merge-conflicts"
import { type MergeConflictViewerLabels, resolveLabels } from "./labels"
import styles from "./MergeConflictViewer.css?inline"
import { ResultEditor } from "./ResultEditor"

/** Below this container width the "responsive" layout stacks the panes. */
const STACK_BREAKPOINT_PX = 900

/** Unchanged lines kept around each change when unchanged lines are folded. */
const DEFAULT_FOLD_CONTEXT = 3

const STYLE_ELEMENT_ID = "mcv-styles"

const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect

/**
 * Adds the viewer stylesheet once, in front of the host's own styles so they
 * can override it. Apps that render on the server (or use a strict CSP) can
 * import `@ht-rnd/merge-conflict-viewer/styles` instead.
 */
function ensureStyles(): void {
  if (typeof document === "undefined") {
    return
  }
  if (document.getElementById(STYLE_ELEMENT_ID)) {
    return
  }
  const element = document.createElement("style")
  element.id = STYLE_ELEMENT_ID
  element.textContent = styles
  document.head.prepend(element)
}

type Pane = "current" | "result" | "incoming"

type GridStyle = CSSProperties & Record<`--${string}`, string | number>

/**
 * Splits a line into [unchanged prefix, changed middle, unchanged suffix]
 * against its counterpart, ignoring a trailing comma so punctuation that only
 * depends on position is never highlighted.
 */
function splitInlineEdit(
  text: string,
  other: string | null,
): [string, string, string] {
  if (other === null) {
    return [text, "", ""]
  }

  const comma = text.endsWith(",") ? "," : ""
  const a = comma ? text.slice(0, -1) : text
  const b = other.endsWith(",") ? other.slice(0, -1) : other

  let start = 0
  const max = Math.min(a.length, b.length)
  while (start < max && a[start] === b[start]) {
    start++
  }

  let endA = a.length
  let endB = b.length
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--
    endB--
  }

  return [a.slice(0, start), a.slice(start, endA), a.slice(endA) + comma]
}

function CodeText({
  text,
  other,
}: {
  text: string
  other?: string | null
}): JSX.Element {
  if (other === undefined) {
    return <>{text}</>
  }

  const [before, changed, after] = splitInlineEdit(text, other)
  if (!changed) {
    return <>{text}</>
  }

  return (
    <>
      {before}
      <mark className="mcv-edit">{changed}</mark>
      {after}
    </>
  )
}

function ActionButton({
  label,
  pressed,
  variant,
  onClick,
  children,
}: {
  label: string
  pressed?: boolean
  variant: "accept" | "remove"
  onClick: () => void
  children: ReactNode
}): JSX.Element {
  return (
    <button
      type="button"
      className={clsx("mcv-btn", `mcv-btn-${variant}`)}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export type { MergeConflictViewerLabels }

export interface MergeConflictViewerProps {
  /**
   * The "current" or "left" JSON object to compare
   */
  currentJson: JsonObject
  /**
   * The "incoming" or "right" JSON object to compare
   */
  incomingJson: JsonObject
  /**
   * Called on mount and whenever the result or its resolution status changes.
   * `status.allResolved` is `true` once every change has been decided, which
   * is the moment it is safe to merge.
   */
  onMergeChange?: (mergedJson: JsonObject, status: MergeStatus) => void
  /**
   * An existing result. Each change starts on whichever side it matches; a
   * value that matches neither side starts as an edited value. Changes are
   * counted as decided when this is given (see `startUnresolved`).
   */
  initialMergedJson?: JsonObject
  /**
   * When `true`, changes start undecided: the result shows the incoming side
   * but is flagged until someone picks. Defaults to `true` unless
   * `initialMergedJson` is given.
   */
  startUnresolved?: boolean
  /**
   * Controlled decisions per change id (see `useMergeConflicts`). Pair with
   * `onDecisionsChange` to persist a half-finished merge.
   */
  decisions?: Selection
  onDecisionsChange?: (decisions: Selection) => void
  /**
   * Lets users edit the value of a change in the Result pane by hand.
   * Defaults to `false`.
   */
  editable?: boolean
  /**
   * Every text the viewer shows (column titles, buttons, banner, tooltips,
   * accessible names). Override what you need, for example to translate.
   */
  labels?: MergeConflictViewerLabels
  /**
   * Height of the whole viewer (toolbar included). Use `"100%"` to fill a
   * parent with a bounded height. Without it the viewer grows with its
   * content, and the column headers only stay sticky when the height is bounded.
   */
  height?: string | number
  /**
   * Upper bound for the height; the panes scroll beyond it.
   */
  maxHeight?: string | number
  /**
   * Layout of the three panes.
   * - "horizontal": always side by side (Current | Result | Incoming)
   * - "vertical": always stacked (Current, Incoming, then Result)
   * - "responsive": horizontal when there is room, stacked otherwise (default)
   */
  layout?: "horizontal" | "vertical" | "responsive"
  /**
   * Folds long runs of unchanged lines. `true` keeps 3 lines of context around
   * each change, a number sets the amount. Users can toggle it from the
   * toolbar. Defaults to `false`.
   */
  collapseUnchanged?: boolean | number
  /** Hides the toolbar with the bulk actions and navigation. */
  hideToolbar?: boolean
  /** Hides the banner that tells whether everything is resolved. */
  hideStatus?: boolean
  /** Replaces the toolbar with your own, driven by the merge state. */
  renderToolbar?: (state: MergeConflictsState) => ReactNode
  className?: string
  style?: CSSProperties
}

export interface MergeConflictViewerHandle {
  /** The merged document as it currently stands. */
  getResult: () => JsonObject
  getStatus: () => MergeStatus
  /** Resolve every change from one side. */
  applyAll: (side: DiffSide) => void
  /** Back to how the viewer started. Can be undone. */
  reset: () => void
  undo: () => void
  redo: () => void
  /** Scrolls to the next undecided change. Returns `false` if there is none. */
  goToNextUnresolved: () => boolean
  goToChange: (direction: "next" | "previous") => void
}

export const MergeConflictViewer = forwardRef<
  MergeConflictViewerHandle,
  MergeConflictViewerProps
>(function MergeConflictViewer(
  {
    currentJson,
    incomingJson,
    onMergeChange,
    initialMergedJson,
    startUnresolved,
    decisions,
    onDecisionsChange,
    editable = false,
    labels,
    height,
    maxHeight,
    layout = "responsive",
    collapseUnchanged = false,
    hideToolbar = false,
    hideStatus = false,
    renderToolbar,
    className,
    style,
  },
  ref,
) {
  useInsertionEffect(ensureStyles, [])
  const t = resolveLabels(labels)

  const state = useMergeConflicts({
    currentJson,
    incomingJson,
    initialMergedJson,
    startUnresolved,
    decisions,
    onDecisionsChange,
  })
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

  // ---- Layout mode --------------------------------------------------------

  const rootRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [narrow, setNarrow] = useState(false)

  useIsomorphicLayoutEffect(() => {
    const element = scrollRef.current
    if (
      layout !== "responsive" ||
      !element ||
      typeof ResizeObserver === "undefined"
    ) {
      return
    }

    const observer = new ResizeObserver(([entry]) => {
      setNarrow(entry.contentRect.width < STACK_BREAKPOINT_PX)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [layout])

  const stacked = layout === "vertical" || (layout === "responsive" && narrow)

  // ---- Folding unchanged lines -------------------------------------------

  const foldContext =
    typeof collapseUnchanged === "number"
      ? collapseUnchanged
      : DEFAULT_FOLD_CONTEXT
  const [collapsed, setCollapsed] = useState(collapseUnchanged !== false)
  const [expandedFolds, setExpandedFolds] = useState<ReadonlySet<string>>(
    () => new Set(),
  )

  const items = useMemo<DisplayItem[]>(
    () =>
      collapsed
        ? foldRows(mergeLayout.rows, foldContext, expandedFolds)
        : mergeLayout.rows.map((row) => ({ type: "row", row })),
    [collapsed, mergeLayout, foldContext, expandedFolds],
  )

  const expandFold = (key: string): void => {
    setExpandedFolds((prev) => new Set(prev).add(key))
  }

  // ---- Navigation ---------------------------------------------------------

  const [activeId, setActiveId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  const order = useMemo(() => tree.conflicts.map((c) => c.id), [tree])

  const scrollToBlock = (id: string): void => {
    const nodes = Array.from(
      rootRef.current?.querySelectorAll<HTMLElement>("[data-mcv-block]") ?? [],
    ).filter((node) => node.dataset.mcvBlock === id)
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

  const handleRef = useRef({ state, goToNextUnresolved, goToChange })
  handleRef.current = { state, goToNextUnresolved, goToChange }

  useImperativeHandle(
    ref,
    () => ({
      getResult: () => handleRef.current.state.merged,
      getStatus: () => handleRef.current.state.status,
      applyAll: (side) => handleRef.current.state.applyAll(side),
      reset: () => handleRef.current.state.reset(),
      undo: () => handleRef.current.state.undo(),
      redo: () => handleRef.current.state.redo(),
      goToNextUnresolved: () => handleRef.current.goToNextUnresolved(),
      goToChange: (direction) => handleRef.current.goToChange(direction),
    }),
    [],
  )

  // Ctrl/Cmd+Z and Ctrl+Shift+Z / Ctrl+Y while focus is inside the viewer.
  // Text fields keep their own undo.
  useEffect(() => {
    const element = rootRef.current
    if (!element) {
      return
    }

    const onKeyDown = (event: KeyboardEvent): void => {
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
        handleRef.current.state.undo()
      } else if ((key === "z" && event.shiftKey) || key === "y") {
        event.preventDefault()
        handleRef.current.state.redo()
      }
    }

    element.addEventListener("keydown", onKeyDown)
    return () => element.removeEventListener("keydown", onKeyDown)
  }, [])

  // ---- Actions ------------------------------------------------------------

  const choose = (id: string, side: SideSelection): void => {
    state.choose(id, side)
    setActiveId(id)
  }

  const editorText = (block: MergeBlock): string => {
    const resolved = resolveConflict(block.entry, selection[block.id])
    const value = resolved.present
      ? resolved.value
      : block.entry.hasRight
        ? block.entry.right
        : block.entry.left
    return JSON.stringify(value, null, 2) ?? "null"
  }

  // ---- Rendering ----------------------------------------------------------

  const renderRow = (row: MergeRow, displayIndex: number): JSX.Element => {
    const block = row.blockId ? blockById.get(row.blockId) : undefined
    const isFirst = row.blockRow === 0
    const isLast = row.blockRow === row.blockSize - 1
    const resolved = block ? isResolved(block.id) : true
    const entry = block?.entry

    const cellClass = (
      pane: Pane,
      column: "no" | "act" | "code",
      text: string | null,
    ): string => {
      const accepted =
        pane === "current"
          ? block?.selection === "left"
          : pane === "incoming"
            ? block?.selection === "right"
            : true

      return clsx("mcv-cell", `mcv-pane-${pane}`, `mcv-col-${column}`, {
        "mcv-block": block,
        "mcv-tint-modified": block?.kind === "modified",
        "mcv-tint-added": block && block.kind !== "modified",
        "mcv-first": block && isFirst,
        "mcv-last": block && isLast,
        "mcv-filler": block && text === null,
        "mcv-rejected": block && text !== null && resolved && !accepted,
        "mcv-pending": block && pane === "result" && !resolved,
        "mcv-edited":
          block && pane === "result" && block.selection === "custom",
        "mcv-active": block && activeId === block.id,
      })
    }

    const blockAttribute = (): { "data-mcv-block"?: string } =>
      block && isFirst ? { "data-mcv-block": block.id } : {}

    const inlineOther = (own: string | null, other: string | null) =>
      block?.kind === "modified" && own !== null && other !== null
        ? other
        : undefined

    const leftActions =
      block && entry && isFirst && entry.hasLeft ? (
        <>
          <ActionButton
            label={t.removeChange(entry.label)}
            variant="remove"
            pressed={resolved && block.selection === "deleted"}
            onClick={() => choose(block.id, "deleted")}
          >
            <X size={14} />
          </ActionButton>
          <ActionButton
            label={t.acceptCurrent(entry.label)}
            variant="accept"
            pressed={resolved && block.selection === "left"}
            onClick={() => choose(block.id, "left")}
          >
            <ChevronsRight size={14} />
          </ActionButton>
        </>
      ) : null

    const rightActions =
      block && entry && isFirst && entry.hasRight ? (
        <>
          <ActionButton
            label={t.acceptIncoming(entry.label)}
            variant="accept"
            pressed={resolved && block.selection === "right"}
            onClick={() => choose(block.id, "right")}
          >
            <ChevronsLeft size={14} />
          </ActionButton>
          <ActionButton
            label={t.removeChange(entry.label)}
            variant="remove"
            pressed={resolved && block.selection === "deleted"}
            onClick={() => choose(block.id, "deleted")}
          >
            <X size={14} />
          </ActionButton>
        </>
      ) : null

    const resultTools =
      editable && block && entry && isFirst ? (
        <div className="mcv-result-tools">
          {block.selection === "custom" && (
            <ActionButton
              label={t.revertEdit(entry.label)}
              variant="accept"
              onClick={() => state.revert(block.id)}
            >
              <Undo2 size={14} />
            </ActionButton>
          )}
          <ActionButton
            label={t.editChange(entry.label)}
            variant="accept"
            onClick={() => {
              setActiveId(block.id)
              setEditingId(block.id)
            }}
          >
            <Pencil size={14} />
          </ActionButton>
        </div>
      ) : null

    const editor =
      editable && block && entry && isFirst && editingId === block.id ? (
        <ResultEditor
          title={t.editorTitle(entry.label)}
          inputLabel={t.editorInput(entry.label)}
          applyLabel={t.apply}
          cancelLabel={t.cancel}
          initialText={editorText(block)}
          onCancel={() => setEditingId(null)}
          onCommit={(value) => {
            state.choose(block.id, { custom: value })
            setEditingId(null)
          }}
        />
      ) : null

    return (
      <div
        key={row.index}
        className="mcv-row"
        style={{ "--r": displayIndex } as GridStyle}
      >
        <div
          className={cellClass("current", "code", row.left)}
          {...blockAttribute()}
        >
          {row.left !== null && (
            <CodeText
              text={row.left}
              other={inlineOther(row.left, row.right)}
            />
          )}
        </div>
        <div className={cellClass("current", "act", row.left)}>
          {leftActions}
        </div>
        <div className={cellClass("current", "no", row.left)} aria-hidden>
          {row.leftNo}
        </div>

        <div className={cellClass("result", "no", row.result)} aria-hidden>
          {row.resultNo}
        </div>
        <div
          className={cellClass("result", "code", row.result)}
          {...blockAttribute()}
        >
          {row.result}
          {resultTools}
          {editor}
        </div>

        <div className={cellClass("incoming", "no", row.right)} aria-hidden>
          {row.rightNo}
        </div>
        <div className={cellClass("incoming", "act", row.right)}>
          {rightActions}
        </div>
        <div
          className={cellClass("incoming", "code", row.right)}
          {...blockAttribute()}
        >
          {row.right !== null && (
            <CodeText
              text={row.right}
              other={inlineOther(row.right, row.left)}
            />
          )}
        </div>
      </div>
    )
  }

  const renderFold = (
    item: Extract<DisplayItem, { type: "fold" }>,
    displayIndex: number,
  ): JSX.Element => {
    const text = t.unchangedLines(item.hidden)
    const panes: Pane[] = ["current", "result", "incoming"]

    return (
      <div
        key={`fold-${item.key}`}
        className="mcv-row"
        style={{ "--r": displayIndex } as GridStyle}
      >
        {panes.map((pane) => (
          <button
            key={pane}
            type="button"
            className={clsx("mcv-cell", "mcv-fold", `mcv-pane-${pane}`)}
            tabIndex={pane === "current" ? 0 : -1}
            aria-hidden={pane === "current" ? undefined : true}
            aria-label={t.showUnchanged(item.hidden)}
            onClick={() => expandFold(item.key)}
          >
            ⋯ {text}
          </button>
        ))}
      </div>
    )
  }

  let displayIndex = 0
  const renderedItems = items.map((item) => {
    const index = displayIndex++
    return item.type === "row"
      ? renderRow(item.row, index)
      : renderFold(item, index)
  })

  const total = status.total

  const statusState =
    total === 0 ? "empty" : status.allResolved ? "resolved" : "pending"

  const statusText =
    total === 0
      ? t.noChanges
      : status.allResolved
        ? t.allResolved(status)
        : t.unresolved(status)

  const toolbar = renderToolbar ? (
    renderToolbar(state)
  ) : hideToolbar ? null : (
    <div className="mcv-toolbar">
      <button
        type="button"
        className="mcv-button"
        onClick={() => state.applyAll("left")}
      >
        {t.applyAllCurrent}
      </button>
      <button
        type="button"
        className="mcv-button"
        onClick={() => state.applyAll("right")}
      >
        {t.applyAllIncoming}
      </button>

      <div className="mcv-toolbar-group">
        <button
          type="button"
          className="mcv-button mcv-button-icon"
          aria-label={t.previousChange}
          title={t.previousChange}
          disabled={total === 0}
          onClick={() => goToChange("previous")}
        >
          <ChevronUp size={16} />
        </button>
        <button
          type="button"
          className="mcv-button mcv-button-icon"
          aria-label={t.nextChange}
          title={t.nextChange}
          disabled={total === 0}
          onClick={() => goToChange("next")}
        >
          <ChevronDown size={16} />
        </button>
      </div>

      <div className="mcv-toolbar-group">
        <button
          type="button"
          className="mcv-button mcv-button-icon"
          aria-label={t.undo}
          title={`${t.undo} (Ctrl+Z)`}
          disabled={!state.canUndo}
          onClick={state.undo}
        >
          <Undo2 size={16} />
        </button>
        <button
          type="button"
          className="mcv-button mcv-button-icon"
          aria-label={t.redo}
          title={`${t.redo} (Ctrl+Shift+Z)`}
          disabled={!state.canRedo}
          onClick={state.redo}
        >
          <Redo2 size={16} />
        </button>
      </div>

      <button
        type="button"
        className="mcv-button"
        aria-pressed={collapsed}
        onClick={() => setCollapsed((value) => !value)}
      >
        {t.hideUnchanged}
      </button>

      <span className="mcv-summary">{t.summary(status)}</span>
    </div>
  )

  const statusBar = hideStatus ? null : (
    <div className={clsx("mcv-status", `mcv-status-${statusState}`)}>
      {statusState === "resolved" ? (
        <CircleCheck className="mcv-status-icon" size={18} aria-hidden />
      ) : statusState === "pending" ? (
        <CircleAlert className="mcv-status-icon" size={18} aria-hidden />
      ) : (
        <Info className="mcv-status-icon" size={18} aria-hidden />
      )}
      <output className="mcv-status-text">{statusText}</output>
      {total > 0 && (
        <div className="mcv-progress" aria-hidden>
          <div
            className="mcv-progress-bar"
            style={{ width: `${(status.resolved / total) * 100}%` }}
          />
        </div>
      )}
      {statusState === "pending" && (
        <button
          type="button"
          className="mcv-button mcv-button-small"
          onClick={goToNextUnresolved}
        >
          {t.nextUnresolved}
        </button>
      )}
    </div>
  )

  return (
    <div
      ref={rootRef}
      className={clsx("mcv-root", className)}
      style={{ height, maxHeight, ...style }}
      data-mcv-status={statusState}
    >
      {toolbar}
      {statusBar}

      <div ref={scrollRef} className="mcv-scroll">
        <div
          className={clsx("mcv-grid", { "mcv-stacked": stacked })}
          style={{ "--n": displayIndex } as GridStyle}
        >
          <div className="mcv-header mcv-pane-current">{t.current}</div>
          <div className="mcv-header mcv-pane-result">{t.result}</div>
          <div className="mcv-header mcv-pane-incoming">{t.incoming}</div>

          {renderedItems}
        </div>
      </div>
    </div>
  )
})
