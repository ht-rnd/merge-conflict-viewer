// Headless viewer: state, behaviour and prop getters for your own UI
export type { DisplayItem } from "./folding"
export { foldRows } from "./folding"
export type { InlineSegment } from "./inline-diff"
export { inlineSegments, splitInlineEdit } from "./inline-diff"
export type { MergeViewerLabels, ResolvedLabels } from "./labels"
export { defaultLabels, resolveLabels } from "./labels"
// Merge model: pure functions that work anywhere (browser, server, CLI)
export type {
  Choice,
  ConflictEntry,
  ConflictKind,
  CustomChoice,
  MergeBlock,
  MergeLayout,
  MergeRow,
  MergeStatus,
  MergeTree,
  ResolvedChoice,
  Selection,
} from "./merge-model"
export {
  buildMergedJson,
  buildMergeLayout,
  buildMergeTree,
  deepEqual,
  getMergeStatus,
  initialSelection,
  isCustomChoice,
  selectAll,
} from "./merge-model"
export {
  MergeViewerProvider,
  useMergeViewerContext,
} from "./merge-viewer-context"
export type {
  CellPlacement,
  GridLayout,
  MergeColumn,
  MergePane,
} from "./placement"
export { gridTemplateColumns, placeCell } from "./placement"
export type { DiffSide, JsonObject, SideSelection } from "./types/index"
export type {
  MergeConflictsState,
  UseMergeConflictsOptions,
} from "./use-merge-conflicts"
export { useMergeConflicts } from "./use-merge-conflicts"
export type {
  MergeCellState,
  MergeViewer,
  MergeViewerAction,
  MergeViewerFold,
  MergeViewerItem,
  MergeViewerLayout,
  MergeViewerLine,
  MergeViewerRow,
  MergeViewerStatusState,
  UseMergeViewerOptions,
} from "./use-merge-viewer"
export { useMergeViewer } from "./use-merge-viewer"
