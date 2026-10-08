// Component
export type {
  MergeConflictViewerHandle,
  MergeConflictViewerLabels,
  MergeConflictViewerProps,
} from "../components/MergeConflictViewer"
export { MergeConflictViewer } from "../components/MergeConflictViewer"

// Headless API: the same merge logic without any UI
export type { DisplayItem } from "./folding"
export { foldRows } from "./folding"
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
export type { DiffSide, JsonObject, SideSelection } from "./types/index"
export type {
  MergeConflictsState,
  UseMergeConflictsOptions,
} from "./use-merge-conflicts"
export { useMergeConflicts } from "./use-merge-conflicts"
