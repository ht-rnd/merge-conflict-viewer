export interface InlineSegment {
  text: string
  /** `true` for the characters that differ from the other side. */
  changed: boolean
}

/**
 * Splits a line into [unchanged prefix, changed middle, unchanged suffix]
 * against its counterpart, ignoring a trailing comma so punctuation that only
 * depends on position is never highlighted.
 */
export function splitInlineEdit(
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

/**
 * The line as renderable segments: one plain segment, or prefix / changed /
 * suffix when `other` is given and the lines differ. Empty segments are left
 * out, so joining the texts always gives back the line.
 */
export function inlineSegments(
  text: string,
  other: string | null | undefined,
): InlineSegment[] {
  if (other === undefined || other === null) {
    return [{ text, changed: false }]
  }

  const [before, changed, after] = splitInlineEdit(text, other)
  if (!changed) {
    return [{ text, changed: false }]
  }

  const segments: InlineSegment[] = []
  if (before) {
    segments.push({ text: before, changed: false })
  }
  segments.push({ text: changed, changed: true })
  if (after) {
    segments.push({ text: after, changed: false })
  }
  return segments
}
