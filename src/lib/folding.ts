import type { MergeRow } from "./merge-model"

export type DisplayItem =
  | { type: "row"; row: MergeRow }
  | {
      type: "fold"
      /** Stable across re-layouts: the changes on either side of the fold. */
      key: string
      hidden: number
    }

/** Folding fewer lines than this would be more noise than it saves. */
const MIN_HIDDEN_ROWS = 3

/**
 * Collapses long runs of unchanged rows into a single "fold", keeping
 * `context` rows next to each change (and the first/last line of the
 * document). Folds listed in `expanded` are left open.
 */
export function foldRows(
  rows: MergeRow[],
  context: number,
  expanded: ReadonlySet<string>,
): DisplayItem[] {
  const items: DisplayItem[] = []
  const emit = (from: number, to: number): void => {
    for (let i = from; i < to; i++) {
      items.push({ type: "row", row: rows[i] })
    }
  }

  let i = 0
  while (i < rows.length) {
    if (rows[i].blockId !== null) {
      items.push({ type: "row", row: rows[i] })
      i++
      continue
    }

    let end = i
    while (end < rows.length && rows[end].blockId === null) {
      end++
    }

    const keepStart = i === 0 ? 1 : context
    const keepEnd = end === rows.length ? 1 : context
    const hidden = end - i - keepStart - keepEnd
    const key = `${rows[i - 1]?.blockId ?? "start"}>${rows[end]?.blockId ?? "end"}`

    if (hidden < MIN_HIDDEN_ROWS || expanded.has(key)) {
      emit(i, end)
    } else {
      emit(i, i + keepStart)
      items.push({ type: "fold", key, hidden })
      emit(end - keepEnd, end)
    }
    i = end
  }

  return items
}
