import type { MergeStatus } from "./merge-model"

/**
 * Every piece of text a merge viewer shows, so it can be translated or reworded.
 * Anything you leave out keeps its English default. Functions receive what
 * they need to build the sentence (a change label such as `address.city`, a
 * count, or the merge status).
 */
export interface MergeViewerLabels {
  // Column titles
  current?: string
  result?: string
  incoming?: string

  // Toolbar
  applyAllCurrent?: string
  applyAllIncoming?: string
  previousChange?: string
  nextChange?: string
  hideUnchanged?: string
  undo?: string
  redo?: string
  /** Right-hand summary of the toolbar, e.g. "11 changes". */
  summary?: (status: MergeStatus) => string

  // Status banner
  noChanges?: string
  unresolved?: (status: MergeStatus) => string
  allResolved?: (status: MergeStatus) => string
  nextUnresolved?: string

  // Folded lines
  unchangedLines?: (count: number) => string
  showUnchanged?: (count: number) => string

  // Per-change buttons (also used as tooltips and accessible names)
  acceptCurrent?: (change: string) => string
  acceptIncoming?: (change: string) => string
  removeChange?: (change: string) => string
  editChange?: (change: string) => string
  revertEdit?: (change: string) => string

  // Value editor
  editorTitle?: (change: string) => string
  editorInput?: (change: string) => string
  apply?: string
  cancel?: string
}

export type ResolvedLabels = Required<MergeViewerLabels>

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many
}

export const defaultLabels: ResolvedLabels = {
  current: "Current",
  result: "Result",
  incoming: "Incoming",

  applyAllCurrent: "Apply all from current",
  applyAllIncoming: "Apply all from incoming",
  previousChange: "Previous change",
  nextChange: "Next change",
  hideUnchanged: "Hide unchanged lines",
  undo: "Undo",
  redo: "Redo",
  summary: ({ total }) =>
    total === 0
      ? "No differences"
      : `${total} ${plural(total, "change", "changes")}`,

  noChanges: "No differences. Nothing to merge.",
  unresolved: ({ unresolved, total }) =>
    `${unresolved} of ${total} ${plural(total, "change", "changes")} still ${plural(
      unresolved,
      "needs",
      "need",
    )} a decision.`,
  allResolved: ({ total }) =>
    `All ${total} ${plural(total, "change", "changes")} resolved. Safe to merge.`,
  nextUnresolved: "Next unresolved",

  unchangedLines: (count) =>
    `${count} unchanged ${plural(count, "line", "lines")}`,
  showUnchanged: (count) =>
    `Show ${count} unchanged ${plural(count, "line", "lines")}`,

  acceptCurrent: (change) => `Accept current ${change}`,
  acceptIncoming: (change) => `Accept incoming ${change}`,
  removeChange: (change) => `Remove ${change} from result`,
  editChange: (change) => `Edit ${change} in result`,
  revertEdit: (change) => `Revert edit of ${change}`,

  editorTitle: (change) => `Edit ${change} (JSON value)`,
  editorInput: (change) => `JSON value of ${change}`,
  apply: "Apply",
  cancel: "Cancel",
}

/** Defaults overlaid with the labels the host provided. */
export function resolveLabels(
  labels: MergeViewerLabels | undefined,
): ResolvedLabels {
  const resolved: Record<string, unknown> = { ...defaultLabels }
  for (const [key, value] of Object.entries(labels ?? {})) {
    if (value !== undefined) {
      resolved[key] = value
    }
  }
  return resolved as ResolvedLabels
}
