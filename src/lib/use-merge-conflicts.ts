import { useMemo, useRef, useState } from "react"
import {
  buildMergedJson,
  buildMergeTree,
  type Choice,
  deepEqual,
  getMergeStatus,
  initialSelection,
  type MergeStatus,
  type MergeTree,
  type Selection,
  selectAll,
} from "./merge-model"
import type { DiffSide, JsonObject } from "./types/index"

export interface UseMergeConflictsOptions {
  /** The "current" (left) document. */
  currentJson: JsonObject
  /** The "incoming" (right) document. */
  incomingJson: JsonObject
  /**
   * A previous result. Each change starts on whichever side it matches; a
   * value that matches neither side starts as a hand-written value.
   */
  initialMergedJson?: JsonObject
  /**
   * When `true`, no change counts as decided until the user (or code) picks
   * one, so `status.allResolved` reflects real review work. Defaults to `true`
   * unless `initialMergedJson` is given (an existing result counts as decided).
   */
  startUnresolved?: boolean
  /**
   * Controlled mode: the explicit decisions per change id. Pair it with
   * `onDecisionsChange`. Persist this to resume a half-finished merge.
   */
  decisions?: Selection
  onDecisionsChange?: (decisions: Selection) => void
}

export interface MergeConflictsState {
  /** Structural comparison of both documents. */
  tree: MergeTree
  /** Explicit decisions only (what to persist). Undecided changes are absent. */
  decisions: Selection
  /** What the result contains per change, including undecided defaults. */
  selection: Selection
  /** The merged document. */
  merged: JsonObject
  status: MergeStatus
  isResolved: (id: string) => boolean
  /** Decide a change: a side, `"deleted"`, or `{ custom: value }`. */
  choose: (id: string, choice: Choice) => void
  /** Undo a decision, back to how the change started. */
  revert: (id: string) => void
  applyAll: (side: DiffSide) => void
  /** Back to how the merge started. Can be undone. */
  reset: () => void
  /** Step back through your decisions (up to 100). */
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
}

/** How many decisions can be undone. */
const HISTORY_LIMIT = 100

interface History {
  past: Selection[]
  future: Selection[]
}

/**
 * Headless merge state: everything `MergeConflictViewer` does, without the UI.
 * Use it to build your own interface, or to read the result and status
 * next to the component.
 */
export function useMergeConflicts({
  currentJson,
  incomingJson,
  initialMergedJson,
  startUnresolved,
  decisions: controlledDecisions,
  onDecisionsChange,
}: UseMergeConflictsOptions): MergeConflictsState {
  const currentKey = useMemo(() => JSON.stringify(currentJson), [currentJson])
  const incomingKey = useMemo(
    () => JSON.stringify(incomingJson),
    [incomingJson],
  )
  const initialKey = useMemo(
    () =>
      initialMergedJson === undefined
        ? undefined
        : JSON.stringify(initialMergedJson),
    [initialMergedJson],
  )

  const tree = useMemo(
    () => buildMergeTree(currentJson, incomingJson),
    [currentKey, incomingKey],
  )

  /** How every change starts (and what "reset" goes back to). */
  const defaults = useMemo(
    () => initialSelection(tree, initialMergedJson),
    [tree, initialKey],
  )
  const startsUnresolved = startUnresolved ?? initialMergedJson === undefined
  const startingDecisions = (): Selection => (startsUnresolved ? {} : defaults)

  const [internal, setInternal] = useState<Selection>(startingDecisions)

  const historyRef = useRef<History>({ past: [], future: [] })
  const [, rerender] = useState(0)

  // Start over when the compared documents change (React "derived state").
  const [internalTree, setInternalTree] = useState(tree)
  if (internalTree !== tree) {
    setInternalTree(tree)
    setInternal(startingDecisions())
    historyRef.current = { past: [], future: [] }
  }

  const controlled = controlledDecisions !== undefined
  const decisions = controlled ? controlledDecisions : internal

  const decisionsRef = useRef(decisions)
  decisionsRef.current = decisions
  const onChangeRef = useRef(onDecisionsChange)
  onChangeRef.current = onDecisionsChange

  const apply = (next: Selection): void => {
    decisionsRef.current = next
    if (!controlled) {
      setInternal(next)
    }
    onChangeRef.current?.(next)
    rerender((count) => count + 1)
  }

  /** Applies a decision and remembers the previous state for undo. */
  const commit = (next: Selection): void => {
    if (deepEqual(next, decisionsRef.current)) {
      return
    }
    const history = historyRef.current
    history.past.push(decisionsRef.current)
    if (history.past.length > HISTORY_LIMIT) {
      history.past.shift()
    }
    history.future = []
    apply(next)
  }

  const selection = useMemo(
    () => ({ ...defaults, ...decisions }),
    [defaults, decisions],
  )
  const merged = useMemo(
    () => buildMergedJson(tree, selection),
    [tree, selection],
  )
  const status = useMemo(
    () => getMergeStatus(tree, decisions),
    [tree, decisions],
  )

  return {
    tree,
    decisions,
    selection,
    merged,
    status,
    isResolved: (id) => Object.hasOwn(decisions, id),
    choose: (id, choice) => commit({ ...decisionsRef.current, [id]: choice }),
    revert: (id) => {
      const next = { ...decisionsRef.current }
      const start = startingDecisions()
      if (Object.hasOwn(start, id)) {
        next[id] = start[id]
      } else {
        delete next[id]
      }
      commit(next)
    },
    applyAll: (side) => commit(selectAll(tree, side)),
    reset: () => commit(startingDecisions()),
    undo: () => {
      const history = historyRef.current
      const previous = history.past.pop()
      if (previous) {
        history.future.push(decisionsRef.current)
        apply(previous)
      }
    },
    redo: () => {
      const history = historyRef.current
      const next = history.future.pop()
      if (next) {
        history.past.push(decisionsRef.current)
        apply(next)
      }
    },
    canUndo: historyRef.current.past.length > 0,
    canRedo: historyRef.current.future.length > 0,
  }
}
