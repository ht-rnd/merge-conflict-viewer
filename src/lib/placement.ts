export type MergePane = "current" | "result" | "incoming"

/**
 * What a grid cell holds. `code` is the JSON text, `number` the line number,
 * `actions` the accept/remove buttons. `header` is a pane title and `fold` a
 * "N unchanged lines" row; both span the columns of their pane.
 */
export type MergeColumn = "code" | "actions" | "number" | "header" | "fold"

/** `stacked` puts the panes below each other: Current, Incoming, Result. */
export type GridLayout = "horizontal" | "stacked"

export interface CellPlacement {
  gridRow: number
  gridColumn: string
}

/**
 * Horizontal grid: one track per column of every pane.
 *
 *   current: code | actions | number   result: number | code
 *   incoming: number | actions | code
 */
export const HORIZONTAL_COLUMNS =
  "minmax(0, 1fr) 3.5rem 3.5ch 3.5ch minmax(0, 1fr) 3.5ch 3.5rem minmax(0, 1fr)"

/** Stacked grid: number | actions | code, shared by all three panes. */
export const STACKED_COLUMNS = "3.5ch 3.5rem minmax(0, 1fr)"

const HORIZONTAL: Record<MergePane, Partial<Record<MergeColumn, string>>> = {
  current: {
    code: "1",
    actions: "2",
    number: "3",
    header: "1 / 4",
    fold: "1 / 4",
  },
  result: {
    number: "4",
    code: "5",
    header: "4 / 6",
    fold: "4 / 6",
  },
  incoming: {
    number: "6",
    actions: "7",
    code: "8",
    header: "6 / 9",
    fold: "6 / 9",
  },
}

const STACKED: Record<MergePane, Partial<Record<MergeColumn, string>>> = {
  current: {
    number: "1",
    actions: "2",
    code: "3",
    header: "1 / -1",
    fold: "1 / -1",
  },
  incoming: {
    number: "1",
    actions: "2",
    code: "3",
    header: "1 / -1",
    fold: "1 / -1",
  },
  // The result has no accept/remove buttons, so its text takes their track.
  result: {
    number: "1",
    code: "2 / 4",
    header: "1 / -1",
    fold: "1 / -1",
  },
}

/** Stacked panes appear in this order, one band of rows each. */
const STACK_ORDER: Record<MergePane, number> = {
  current: 0,
  incoming: 1,
  result: 2,
}

/**
 * Where a cell goes in the viewer's CSS grid, so every pane shares the same
 * row heights without any structural CSS.
 *
 * @param rowIndex position of the row among the displayed rows (folds count
 * as one row); ignored for headers
 * @param rowCount number of displayed rows
 */
export function placeCell(
  layout: GridLayout,
  pane: MergePane,
  column: MergeColumn,
  rowIndex: number,
  rowCount: number,
): CellPlacement {
  const columns = layout === "stacked" ? STACKED : HORIZONTAL
  const gridColumn = columns[pane][column] ?? "auto"

  if (layout === "horizontal") {
    return { gridRow: column === "header" ? 1 : rowIndex + 2, gridColumn }
  }

  const band = STACK_ORDER[pane] * (rowCount + 1)
  return {
    gridRow: column === "header" ? band + 1 : band + rowIndex + 2,
    gridColumn,
  }
}

export function gridTemplateColumns(layout: GridLayout): string {
  return layout === "stacked" ? STACKED_COLUMNS : HORIZONTAL_COLUMNS
}
