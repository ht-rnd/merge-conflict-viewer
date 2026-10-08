import type { JsonObject, SideSelection } from "./types/index"

const INDENT = "  "

/**
 * Fields that commonly identify an item of an array of objects. The first one
 * present with a unique value on every item (of both arrays) is used to match
 * items between the two sides.
 */
const IDENTITY_FIELDS = ["id", "@id", "key", "name", "code", "uuid", "slug"]

export type ConflictKind = "modified" | "left-only" | "right-only"

/** A hand-written value that replaces both sides of a conflict. */
export interface CustomChoice {
  custom: unknown
}

/** How one conflict is resolved: a side, removal, or a hand-written value. */
export type Choice = SideSelection | CustomChoice

/** What a conflict's result currently contains. */
export type ResolvedChoice = SideSelection | "custom"

/** Choice per conflict, keyed by `ConflictEntry.id`. Missing means "right". */
export type Selection = Record<string, Choice>

export function isCustomChoice(
  choice: Choice | undefined,
): choice is CustomChoice {
  return typeof choice === "object" && choice !== null && "custom" in choice
}

type PathPart = string | number

/** A key (or array item) with an identical value on both sides. */
export interface EqualEntry {
  type: "equal"
  /** Object key, or `null` for an array item. */
  key: string | null
  value: unknown
}

/** An object or array present on both sides whose contents differ. */
export interface ContainerEntry {
  type: "container"
  key: string | null
  container: "object" | "array"
  children: MergeEntry[]
}

/**
 * A key or array item that differs (or exists on one side only). This is the
 * unit of resolution.
 */
export interface ConflictEntry {
  type: "conflict"
  id: string
  key: string | null
  /** Human readable location, e.g. `endpoints.charges` or `tags[2]`. */
  label: string
  path: PathPart[]
  kind: ConflictKind
  hasLeft: boolean
  hasRight: boolean
  left?: unknown
  right?: unknown
}

export type MergeEntry = EqualEntry | ContainerEntry | ConflictEntry

export interface MergeTree {
  children: MergeEntry[]
  conflicts: ConflictEntry[]
}

export interface MergeRow {
  index: number
  /** Conflict id when the row belongs to a conflict block. */
  blockId: string | null
  /** Position of the row inside its block. */
  blockRow: number
  blockSize: number
  /** Text of each pane. `null` means "nothing here" (rendered as filler). */
  left: string | null
  right: string | null
  result: string | null
  leftNo: number | null
  rightNo: number | null
  resultNo: number | null
}

export interface MergeBlock {
  id: string
  entry: ConflictEntry
  kind: ConflictKind
  /** Index of the first row of the block. */
  start: number
  size: number
  /** What the result currently contains for this block. */
  selection: ResolvedChoice
}

export interface MergeLayout {
  rows: MergeRow[]
  blocks: MergeBlock[]
}

function hasOwn(obj: object, key: string): boolean {
  return Object.hasOwn(obj, key)
}

function isPlainObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((item, i) => deepEqual(item, b[i]))
    )
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const keysA = Object.keys(a)
    const keysB = Object.keys(b)
    return (
      keysA.length === keysB.length &&
      keysA.every((key) => hasOwn(b, key) && deepEqual(a[key], b[key]))
    )
  }
  return false
}

/** Stable text for a value: equal values (ignoring key order) give equal text. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonical).join(",")}]`
  }
  if (isPlainObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(",")}}`
  }
  return JSON.stringify(value) ?? "null"
}

function cloneJson<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value))
}

const IDENTIFIER_KEY = /^[A-Za-z_$][\w$]*$/

/** `a.b` for plain keys, `a["odd.key"]` for keys that would be ambiguous. */
function joinLabel(parent: string, key: string): string {
  if (IDENTIFIER_KEY.test(key)) {
    return parent ? `${parent}.${key}` : key
  }
  return `${parent}[${JSON.stringify(key)}]`
}

/**
 * Union of both key lists. Right-hand order wins; keys that only exist on the
 * left are slotted in right after their closest preceding left neighbour.
 */
function mergeKeyOrder(leftKeys: string[], rightKeys: string[]): string[] {
  const order = [...rightKeys]
  const known = new Set(rightKeys)
  let anchor = -1

  for (const key of leftKeys) {
    if (known.has(key)) {
      anchor = order.indexOf(key)
      continue
    }
    anchor += 1
    order.splice(anchor, 0, key)
    known.add(key)
  }

  return order
}

/** Longest common subsequence of two key lists, as increasing index pairs. */
function alignKeys(a: string[], b: string[]): [number, number][] {
  const n = a.length
  const m = b.length
  const width = m + 1
  const table = new Uint32Array((n + 1) * width)

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i * width + j] =
        a[i] === b[j]
          ? table[(i + 1) * width + j + 1] + 1
          : Math.max(table[(i + 1) * width + j], table[i * width + j + 1])
    }
  }

  const pairs: [number, number][] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      pairs.push([i, j])
      i++
      j++
    } else if (table[(i + 1) * width + j] >= table[i * width + j + 1]) {
      i++
    } else {
      j++
    }
  }
  return pairs
}

/**
 * Picks a field that identifies every item of both arrays, so items can be
 * matched by identity (e.g. `id`) even when their contents changed.
 */
function findIdentityField(
  left: unknown[],
  right: unknown[],
): string | undefined {
  return IDENTITY_FIELDS.find((field) =>
    [left, right].every((items) => {
      const seen = new Set<unknown>()
      return items.every((item) => {
        if (!isPlainObject(item) || !hasOwn(item, field)) {
          return false
        }
        const value = item[field]
        if (
          (typeof value !== "string" && typeof value !== "number") ||
          seen.has(value)
        ) {
          return false
        }
        seen.add(value)
        return true
      })
    }),
  )
}

function oneSidedEntry(
  side: "left" | "right",
  key: string | null,
  path: PathPart[],
  label: string,
  value: unknown,
  conflicts: ConflictEntry[],
): ConflictEntry {
  const entry: ConflictEntry = {
    type: "conflict",
    id: JSON.stringify(path),
    key,
    label,
    path,
    kind: side === "left" ? "left-only" : "right-only",
    hasLeft: side === "left",
    hasRight: side === "right",
    left: side === "left" ? value : undefined,
    right: side === "right" ? value : undefined,
  }
  conflicts.push(entry)
  return entry
}

/**
 * Compares the values found at the same place on both sides. Identical values
 * are `equal`; objects and arrays are descended into; anything else (including
 * a type change) is a single `modified` conflict.
 */
function pairedEntry(
  key: string | null,
  path: PathPart[],
  label: string,
  left: unknown,
  right: unknown,
  conflicts: ConflictEntry[],
): MergeEntry {
  if (deepEqual(left, right)) {
    return { type: "equal", key, value: left }
  }

  if (isPlainObject(left) && isPlainObject(right)) {
    return {
      type: "container",
      key,
      container: "object",
      children: diffObjects(left, right, path, label, conflicts),
    }
  }

  if (Array.isArray(left) && Array.isArray(right)) {
    return {
      type: "container",
      key,
      container: "array",
      children: diffArrays(left, right, path, label, conflicts),
    }
  }

  const entry: ConflictEntry = {
    type: "conflict",
    id: JSON.stringify(path),
    key,
    label,
    path,
    kind: "modified",
    hasLeft: true,
    hasRight: true,
    left,
    right,
  }
  conflicts.push(entry)
  return entry
}

function diffObjects(
  left: JsonObject,
  right: JsonObject,
  path: PathPart[],
  label: string,
  conflicts: ConflictEntry[],
): MergeEntry[] {
  const entries: MergeEntry[] = []

  for (const key of mergeKeyOrder(Object.keys(left), Object.keys(right))) {
    const hasLeft = hasOwn(left, key)
    const hasRight = hasOwn(right, key)
    const entryPath = [...path, key]
    const entryLabel = joinLabel(label, key)

    if (hasLeft && hasRight) {
      entries.push(
        pairedEntry(
          key,
          entryPath,
          entryLabel,
          left[key],
          right[key],
          conflicts,
        ),
      )
    } else if (hasLeft) {
      entries.push(
        oneSidedEntry("left", key, entryPath, entryLabel, left[key], conflicts),
      )
    } else {
      entries.push(
        oneSidedEntry(
          "right",
          key,
          entryPath,
          entryLabel,
          right[key],
          conflicts,
        ),
      )
    }
  }

  return entries
}

/**
 * Aligns two arrays into one ordered sequence of entries. Both panes keep the
 * original order of their own items:
 *
 * 1. Items are matched with an LCS alignment, by identity field when every
 *    item has a unique one (`id`, `name`, ...), otherwise by exact equality.
 * 2. Between two matches, remaining items are paired by position and compared
 *    recursively (so an edited object becomes a container, not remove + add).
 * 3. Whatever is left over is a removal (left) or an addition (right).
 */
function diffArrays(
  left: unknown[],
  right: unknown[],
  path: PathPart[],
  label: string,
  conflicts: ConflictEntry[],
): MergeEntry[] {
  const identityField = findIdentityField(left, right)

  const keysFor = (items: unknown[], field: string | undefined): string[] =>
    items.map((item) =>
      field
        ? `${typeof (item as JsonObject)[field]}:${(item as JsonObject)[field]}`
        : canonical(item),
    )

  let anchors = alignKeys(
    keysFor(left, identityField),
    keysFor(right, identityField),
  )
  let matchByIdentity = identityField !== undefined

  // Nothing shares an identity (e.g. the only item got a new id): fall back to
  // pairing by position so it reads as an edit rather than remove + add.
  if (matchByIdentity && anchors.length === 0) {
    matchByIdentity = false
    anchors = alignKeys(keysFor(left, undefined), keysFor(right, undefined))
  }

  const entries: MergeEntry[] = []
  let li = 0
  let ri = 0

  const itemLabel = (index: number): string => `${label}[${index}]`
  const nextPath = (): PathPart[] => [...path, entries.length]

  const pairUp = (l: number, r: number): void => {
    entries.push(
      pairedEntry(null, nextPath(), itemLabel(r), left[l], right[r], conflicts),
    )
  }

  const flushGap = (leftEnd: number, rightEnd: number): void => {
    const pairs = matchByIdentity ? 0 : Math.min(leftEnd - li, rightEnd - ri)

    for (let k = 0; k < pairs; k++) {
      pairUp(li + k, ri + k)
    }
    for (let k = li + pairs; k < leftEnd; k++) {
      entries.push(
        oneSidedEntry(
          "left",
          null,
          nextPath(),
          itemLabel(k),
          left[k],
          conflicts,
        ),
      )
    }
    for (let k = ri + pairs; k < rightEnd; k++) {
      entries.push(
        oneSidedEntry(
          "right",
          null,
          nextPath(),
          itemLabel(k),
          right[k],
          conflicts,
        ),
      )
    }

    li = leftEnd
    ri = rightEnd
  }

  for (const [leftAt, rightAt] of anchors) {
    flushGap(leftAt, rightAt)
    pairUp(leftAt, rightAt)
    li = leftAt + 1
    ri = rightAt + 1
  }
  flushGap(left.length, right.length)

  return entries
}

/**
 * Compares two JSON objects. Objects and arrays present on both sides are
 * descended into (recursively); every other difference becomes one *change*,
 * which is the unit of resolution (accept current, accept incoming, or remove).
 */
export function buildMergeTree(left: JsonObject, right: JsonObject): MergeTree {
  const conflicts: ConflictEntry[] = []
  const children = diffObjects(left, right, [], "", conflicts)
  return { children, conflicts }
}

export interface ResolvedConflict {
  present: boolean
  value?: unknown
  side: "left" | "right" | null
  /** True when the value was written by hand rather than taken from a side. */
  custom?: true
}

export function resolveConflict(
  entry: ConflictEntry,
  selection: Choice | undefined,
): ResolvedConflict {
  const choice = selection ?? "right"

  if (isCustomChoice(choice)) {
    return { present: true, value: choice.custom, side: null, custom: true }
  }
  if (choice === "left" && entry.hasLeft) {
    return { present: true, value: entry.left, side: "left" }
  }
  if (choice === "right" && entry.hasRight) {
    return { present: true, value: entry.right, side: "right" }
  }
  return { present: false, side: null }
}

/**
 * Selecting a side that has no value for this entry is the same as removing
 * it, so the UI normalises both to "deleted".
 */
export function effectiveSelection(
  entry: ConflictEntry,
  selection: Choice | undefined,
): ResolvedChoice {
  const resolved = resolveConflict(entry, selection)
  return resolved.custom ? "custom" : (resolved.side ?? "deleted")
}

export function selectAll(tree: MergeTree, side: "left" | "right"): Selection {
  const selection: Selection = {}
  for (const entry of tree.conflicts) {
    selection[entry.id] = side
  }
  return selection
}

function mergeEntries(
  entries: MergeEntry[],
  selection: Selection,
  container: "object" | "array",
): JsonObject | unknown[] {
  const object: JsonObject = {}
  const array: unknown[] = []

  for (const entry of entries) {
    let value: unknown
    if (entry.type === "equal") {
      value = cloneJson(entry.value)
    } else if (entry.type === "container") {
      value = mergeEntries(entry.children, selection, entry.container)
    } else {
      const resolved = resolveConflict(entry, selection[entry.id])
      if (!resolved.present) {
        continue
      }
      value = cloneJson(resolved.value)
    }

    if (container === "array") {
      array.push(value)
    } else if (entry.key !== null) {
      object[entry.key] = value
    }
  }

  return container === "array" ? array : object
}

export function buildMergedJson(
  tree: MergeTree,
  selection: Selection,
): JsonObject {
  return mergeEntries(tree.children, selection, "object") as JsonObject
}

const UNKNOWN = Symbol("unknown")

/** What a conflict should be set to when its value is not in the merged doc. */
function absentSelection(entry: ConflictEntry): SideSelection {
  if (entry.hasLeft && entry.hasRight) {
    return "deleted"
  }
  return entry.hasLeft ? "right" : "left"
}

function deriveSelection(
  entries: MergeEntry[],
  merged: unknown,
  container: "object" | "array",
  selection: Selection,
): void {
  for (const entry of entries) {
    if (entry.type === "equal") {
      continue
    }

    if (entry.type === "container") {
      const child =
        container === "object" &&
        entry.key !== null &&
        isPlainObject(merged) &&
        hasOwn(merged, entry.key)
          ? merged[entry.key]
          : UNKNOWN
      deriveSelection(entry.children, child, entry.container, selection)
      continue
    }

    if (merged === UNKNOWN) {
      selection[entry.id] = "right"
      continue
    }

    let includesLeft = false
    let includesRight = false

    if (container === "object") {
      if (
        entry.key === null ||
        !isPlainObject(merged) ||
        !hasOwn(merged, entry.key)
      ) {
        selection[entry.id] = absentSelection(entry)
        continue
      }
      const value = merged[entry.key]
      includesLeft = entry.hasLeft && deepEqual(value, entry.left)
      includesRight = entry.hasRight && deepEqual(value, entry.right)
      if (!includesLeft && !includesRight) {
        // Present, but equal to neither side: it was edited by hand.
        selection[entry.id] = { custom: cloneJson(value) }
        continue
      }
    } else {
      const items = Array.isArray(merged) ? merged : []
      includesLeft =
        entry.hasLeft && items.some((item) => deepEqual(item, entry.left))
      includesRight =
        entry.hasRight && items.some((item) => deepEqual(item, entry.right))
      if (!includesLeft && !includesRight) {
        selection[entry.id] = absentSelection(entry)
        continue
      }
    }

    selection[entry.id] = includesLeft && !includesRight ? "left" : "right"
  }
}

export interface MergeStatus {
  /** Number of changes between the two documents. */
  total: number
  /** Changes that have been decided on (accepted, removed or edited). */
  resolved: number
  /** Changes still waiting for a decision. */
  unresolved: number
  /** Changes whose result was written by hand. */
  edited: number
  /** `true` when nothing is left to decide: safe to merge. */
  allResolved: boolean
}

/** Counts how many changes are decided. `decisions` holds explicit choices only. */
export function getMergeStatus(
  tree: MergeTree,
  decisions: Selection,
): MergeStatus {
  let resolved = 0
  let edited = 0

  for (const entry of tree.conflicts) {
    if (hasOwn(decisions, entry.id)) {
      resolved++
      if (isCustomChoice(decisions[entry.id])) {
        edited++
      }
    }
  }

  const total = tree.conflicts.length
  return {
    total,
    resolved,
    unresolved: total - resolved,
    edited,
    allResolved: resolved === total,
  }
}

/**
 * Derives which side each conflict should start on from an existing merged
 * document. Without one, everything starts on the incoming side. A key whose
 * value matches neither side becomes a custom (hand-written) value. Items of
 * arrays of objects are only matched when the document is exactly one side.
 */
export function initialSelection(
  tree: MergeTree,
  initialMerged?: JsonObject,
): Selection {
  if (!initialMerged) {
    return selectAll(tree, "right")
  }

  for (const side of ["left", "right"] as const) {
    const all = selectAll(tree, side)
    if (deepEqual(initialMerged, buildMergedJson(tree, all))) {
      return all
    }
  }

  const selection = selectAll(tree, "right")
  deriveSelection(tree.children, initialMerged, "object", selection)
  return selection
}

function valueLines(
  key: string | null,
  value: unknown,
  depth: number,
  trailingComma: boolean,
): string[] {
  const pad = INDENT.repeat(depth)
  const body = (JSON.stringify(value, null, 2) ?? "null").split("\n")
  const lastIndex = body.length - 1
  const prefix = key === null ? "" : `${JSON.stringify(key)}: `

  return body.map((line, i) => {
    const head = i === 0 ? `${prefix}${line}` : line
    return `${pad}${head}${i === lastIndex && trailingComma ? "," : ""}`
  })
}

/**
 * Lays the merge out as aligned rows for three panes: current, result and
 * incoming. A conflict is one block spanning as many rows as its longer side;
 * the shorter side (or a side without the entry) gets `null` cells, which the
 * UI renders as filler. Commas are computed per pane so each pane is valid JSON.
 */
export function buildMergeLayout(
  tree: MergeTree,
  selection: Selection,
): MergeLayout {
  const rows: MergeRow[] = []
  const blocks: MergeBlock[] = []

  const push = (
    left: string | null,
    right: string | null,
    result: string | null,
    blockId: string | null = null,
  ): void => {
    rows.push({
      index: rows.length,
      blockId,
      blockRow: 0,
      blockSize: 1,
      left,
      right,
      result,
      leftNo: null,
      rightNo: null,
      resultNo: null,
    })
  }

  const emitEntries = (entries: MergeEntry[], depth: number): void => {
    const hasLeft = entries.map((e) => e.type !== "conflict" || e.hasLeft)
    const hasRight = entries.map((e) => e.type !== "conflict" || e.hasRight)
    const hasResult = entries.map(
      (e) =>
        e.type !== "conflict" || resolveConflict(e, selection[e.id]).present,
    )
    const lastLeft = hasLeft.lastIndexOf(true)
    const lastRight = hasRight.lastIndexOf(true)
    const lastResult = hasResult.lastIndexOf(true)

    entries.forEach((entry, i) => {
      const commaLeft = i !== lastLeft
      const commaRight = i !== lastRight
      const commaResult = i !== lastResult

      if (entry.type === "equal") {
        const left = valueLines(entry.key, entry.value, depth, commaLeft)
        const right = valueLines(entry.key, entry.value, depth, commaRight)
        const result = valueLines(entry.key, entry.value, depth, commaResult)
        left.forEach((line, j) => {
          push(line, right[j], result[j])
        })
        return
      }

      if (entry.type === "container") {
        const pad = INDENT.repeat(depth)
        const prefix =
          entry.key === null ? "" : `${JSON.stringify(entry.key)}: `
        const [open, close] =
          entry.container === "array" ? ["[", "]"] : ["{", "}"]
        const openLine = `${pad}${prefix}${open}`
        push(openLine, openLine, openLine)
        emitEntries(entry.children, depth + 1)
        push(
          `${pad}${close}${commaLeft ? "," : ""}`,
          `${pad}${close}${commaRight ? "," : ""}`,
          `${pad}${close}${commaResult ? "," : ""}`,
        )
        return
      }

      const left = entry.hasLeft
        ? valueLines(entry.key, entry.left, depth, commaLeft)
        : []
      const right = entry.hasRight
        ? valueLines(entry.key, entry.right, depth, commaRight)
        : []
      const resolved = resolveConflict(entry, selection[entry.id])
      const result = resolved.present
        ? valueLines(entry.key, resolved.value, depth, commaResult)
        : []
      const size = Math.max(left.length, right.length, result.length)
      const start = rows.length

      for (let j = 0; j < size; j++) {
        push(left[j] ?? null, right[j] ?? null, result[j] ?? null, entry.id)
      }

      blocks.push({
        id: entry.id,
        entry,
        kind: entry.kind,
        start,
        size,
        selection: effectiveSelection(entry, selection[entry.id]),
      })
    })
  }

  push("{", "{", "{")
  emitEntries(tree.children, 1)
  push("}", "}", "}")

  for (const block of blocks) {
    for (let j = 0; j < block.size; j++) {
      rows[block.start + j].blockRow = j
      rows[block.start + j].blockSize = block.size
    }
  }

  let leftNo = 0
  let rightNo = 0
  let resultNo = 0
  for (const row of rows) {
    row.leftNo = row.left === null ? null : ++leftNo
    row.rightNo = row.right === null ? null : ++rightNo
    row.resultNo = row.result === null ? null : ++resultNo
  }

  return { rows, blocks }
}
