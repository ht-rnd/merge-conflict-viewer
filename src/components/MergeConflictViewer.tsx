import clsx from "clsx"
import { type Diff as DeepDiff, diff } from "deep-diff"
import { Check, X } from "lucide-react"
import { type JSX, useEffect, useMemo, useState } from "react"
import {
  type ChangeData,
  Diff,
  type FileData,
  Hunk,
  type HunkData,
  markEdits,
  parseDiff,
  type TokenizeOptions,
  tokenize,
} from "react-diff-view"
import { diffLines, formatLines } from "unidiff"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { DiffSide, JsonObject, SideSelection } from "@/lib/types"
import "react-diff-view/style/index.css"
import "./MergeConflictViewer.css"

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
   * Optional callback when the merged result changes
   */
  onMergeChange?: (mergedJson: JsonObject) => void
  /**
   * Optional initial merged JSON (defaults to incomingJson)
   */
  initialMergedJson?: JsonObject
  /**
   * Labels for the three columns
   */
  labels?: {
    current?: string
    incoming?: string
    result?: string
  }
  /**
   * Button labels
   */
  buttonLabels?: {
    applyAllCurrent?: string
    applyAllIncoming?: string
  }
  /**
   * Height of the diff viewer container
   */
  height?: string | number
  /**
   * Layout of the three panes.
   * - "horizontal": always side by side (Current | Incoming | Result)
   * - "vertical": always stacked (diff on top, result below)
   * - "responsive": horizontal on md+ screens, vertical on smaller (default)
   */
  layout?: "horizontal" | "vertical" | "responsive"
}

export function MergeConflictViewer({
  currentJson,
  incomingJson,
  onMergeChange,
  initialMergedJson,
  labels = {},
  buttonLabels = {},
  height,
  layout = "responsive",
}: MergeConflictViewerProps) {
  const [jsonL] = useState<JsonObject>(currentJson)
  const [jsonR] = useState<JsonObject>(incomingJson)

  const [mergedJson, setMergedJson] = useState<JsonObject>(
    initialMergedJson ?? incomingJson,
  )

  const [conflictingKeys, setConflictingKeys] = useState<string[]>([])

  const [selectedKeys, setSelectedKeys] = useState<
    Record<string, SideSelection>
  >({})

  const jsonLString = useMemo(() => JSON.stringify(jsonL, null, 2), [jsonL])
  const jsonRString = useMemo(() => JSON.stringify(jsonR, null, 2), [jsonR])

  const diffText = useMemo(() => {
    return formatLines(diffLines(jsonLString, jsonRString), {
      context: 3,
      aname: "left.json",
      bname: "right.json",
    })
  }, [jsonLString, jsonRString])

  const files = useMemo(() => {
    return parseDiff(diffText, { nearbySequences: "zip" })
  }, [diffText])

  const differences = useMemo(() => diff(jsonL, jsonR), [jsonL, jsonR])

  useEffect(() => {
    if (differences) {
      const conflicts = differences
        .map((d: DeepDiff<JsonObject, JsonObject>) => d.path?.join("."))
        .filter(
          (path: string | undefined): path is string => path !== undefined,
        )

      setConflictingKeys(conflicts)
    } else {
      setConflictingKeys([])
    }
  }, [differences])

  useEffect(() => {
    if (conflictingKeys.length > 0) {
      const initialSelected = conflictingKeys.reduce<
        Record<string, SideSelection>
      >((acc: Record<string, SideSelection>, key: string) => {
        acc[key] = "right"
        return acc
      }, {})
      setSelectedKeys(initialSelected)
    }
  }, [conflictingKeys])

  useEffect(() => {
    onMergeChange?.(mergedJson)
  }, [mergedJson, onMergeChange])

  const getValueByPath = (obj: JsonObject, path: string): unknown => {
    const pathArray = path.split(".")
    return pathArray.reduce<unknown>(
      (acc, key) =>
        acc && typeof acc === "object" ? (acc as JsonObject)[key] : undefined,
      obj,
    )
  }

  const setValueByPath = (
    obj: JsonObject,
    path: string,
    value: unknown,
  ): void => {
    const keys = path.split(".")
    const lastKey = keys.pop()
    let current: JsonObject = obj

    for (const key of keys) {
      if (!current[key] || typeof current[key] !== "object") {
        current[key] = Number.isNaN(Number(key)) ? {} : []
      }
      current = current[key] as JsonObject
    }

    if (lastKey !== undefined) {
      current[lastKey] = value
    }
  }

  const deleteValueByPath = (obj: JsonObject, path: string): void => {
    const keys = path.split(".")
    const lastKey = keys.pop()
    if (!lastKey) return

    let current: JsonObject = obj
    for (const key of keys) {
      if (!current[key] || typeof current[key] !== "object") return
      current = current[key] as JsonObject
    }

    if (Array.isArray(current)) {
      const index = Number(lastKey)
      if (!Number.isNaN(index)) {
        ;(current as unknown[]).splice(index, 1)
      }
    } else {
      delete current[lastKey]
    }
  }

  const handleSelectSide = (key: string, side: DiffSide): void => {
    const value =
      side === "left" ? getValueByPath(jsonL, key) : getValueByPath(jsonR, key)

    setMergedJson((prev: JsonObject) => {
      const updated = JSON.parse(JSON.stringify(prev)) as JsonObject
      setValueByPath(updated, key, value)
      return updated
    })

    setSelectedKeys((prev: Record<string, SideSelection>) => ({
      ...prev,
      [key]: side,
    }))
  }

  const handleDeleteKey = (key: string): void => {
    setMergedJson((prev: JsonObject) => {
      const updated = JSON.parse(JSON.stringify(prev)) as JsonObject
      deleteValueByPath(updated, key)
      return updated
    })

    setSelectedKeys((prev: Record<string, SideSelection>) => ({
      ...prev,
      [key]: "deleted",
    }))
  }

  const applyAllFrom = (side: DiffSide): void => {
    setMergedJson(side === "left" ? jsonL : jsonR)

    if (conflictingKeys.length > 0) {
      const updatedSelectedSides = conflictingKeys.reduce<
        Record<string, SideSelection>
      >((acc: Record<string, SideSelection>, key: string) => {
        acc[key] = side
        return acc
      }, {})
      setSelectedKeys(updatedSelectedSides)
    } else {
      setSelectedKeys({})
    }
  }

  const renderGutter = ({
    change,
    side,
  }: {
    change: ChangeData
    side: "old" | "new"
  }): JSX.Element => {
    const json: DiffSide = side === "new" ? "right" : "left"
    const lineNumber =
      change.type === "normal"
        ? side === "old"
          ? change.oldLineNumber
          : change.newLineNumber
        : change.lineNumber
    const isChangeType = change.type !== "normal"
    let matchingPath: string | undefined

    if (isChangeType) {
      const content = change.content
      const trimmedContent = content.trim()
      const indentation = content.length - content.trimStart().length

      const matchingDiff = differences?.find(
        (d: DeepDiff<JsonObject, JsonObject>) => {
          if (!d.path || d.path.length === 0) return false
          if (d.kind === "A") return true

          const key = d.path[d.path.length - 1]
          const value =
            change.type === "insert" && "rhs" in d
              ? d.rhs
              : change.type === "delete" && "lhs" in d
                ? d.lhs
                : undefined

          let match = false

          if (typeof value !== "object" || value === null) {
            const expectedText = `"${key}": ${JSON.stringify(value)}`
            match =
              trimmedContent === expectedText ||
              trimmedContent === `${expectedText},`
          } else {
            match =
              trimmedContent === `"${key}": {` ||
              trimmedContent === `"${key}": [`
          }

          if (!match) return false
          return indentation === d.path.length * 2
        },
      )

      if (matchingDiff?.path) {
        const lastElement = matchingDiff.path[matchingDiff.path.length - 1]
        const extractedKey = trimmedContent.split('"')[1]
        if (lastElement !== extractedKey) {
          matchingPath = undefined
        } else {
          matchingPath = matchingDiff.path?.join(".")
        }
      }
    }

    return (
      <div className="relative flex justify-end items-center my-px bg-inherit">
        {isChangeType && matchingPath && (
          <div className="mcv-gutter-buttons absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-0.5 z-10">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className={clsx(
                    "cursor-pointer transition-colors hover:text-red-500",
                    {
                      "text-red-600 dark:text-red-400":
                        selectedKeys[matchingPath] === "deleted",
                    },
                  )}
                  onClick={() => {
                    if (matchingPath) handleDeleteKey(matchingPath)
                  }}
                >
                  <X size={16} />
                </button>
              </TooltipTrigger>
              <TooltipContent>Delete key from result</TooltipContent>
            </Tooltip>

            {side === "new" ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className={clsx(
                      "cursor-pointer transition-colors hover:text-blue-500",
                      {
                        "dark:text-blue-400 text-blue-600":
                          selectedKeys[matchingPath] === "right",
                      },
                    )}
                    onClick={() => {
                      if (matchingPath) handleSelectSide(matchingPath, json)
                    }}
                  >
                    <Check size={16} />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Accept incoming value</TooltipContent>
              </Tooltip>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className={clsx(
                      "cursor-pointer transition-colors hover:text-green-500",
                      {
                        "dark:text-green-400 text-green-600":
                          selectedKeys[matchingPath] === "left",
                      },
                    )}
                    onClick={() => {
                      if (matchingPath) handleSelectSide(matchingPath, json)
                    }}
                  >
                    <Check size={16} />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Accept current value</TooltipContent>
              </Tooltip>
            )}
          </div>
        )}
        <span>{lineNumber}</span>
      </div>
    )
  }

  const renderFile = ({ type, hunks }: FileData): JSX.Element => {
    const options = {
      highlight: false,
      enhancers: [markEdits(hunks, { type: "block" })],
    }
    const tokens = tokenize(hunks, options as TokenizeOptions)

    return (
      <Diff
        viewType="split"
        diffType={type}
        hunks={hunks}
        tokens={tokens}
        renderGutter={renderGutter}
      >
        {(hunks: HunkData[]) =>
          hunks.map((hunk) => <Hunk key={hunk.content} hunk={hunk} />)
        }
      </Diff>
    )
  }

  return (
    <TooltipProvider>
      <div>
        <div className="flex flex-col md:flex-row gap-2 pb-2">
          <Button variant="outline" onClick={() => applyAllFrom("left")}>
            {buttonLabels.applyAllCurrent ?? "Apply all from current"}
          </Button>

          <Button variant="outline" onClick={() => applyAllFrom("right")}>
            {buttonLabels.applyAllIncoming ?? "Apply all from incoming"}
          </Button>
        </div>

        <div
          className="overflow-auto border border-input rounded-lg"
          style={{
            height: typeof height === "number" ? `${height}px` : height,
          }}
        >
          <div
            className={
              layout === "horizontal"
                ? "grid grid-cols-3 min-h-full"
                : layout === "vertical"
                  ? "grid grid-cols-1 min-h-full"
                  : "grid grid-cols-1 min-h-full md:grid-cols-3"
            }
          >
            <div className="border-b last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0">
              <p className="p-2 border-b">{labels.current ?? "Current"}</p>
              <div className="mcv-old-only overflow-hidden">
                {files.map(renderFile)}
              </div>
            </div>
            <div className="border-b last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0">
              <p className="p-2 border-b">{labels.incoming ?? "Incoming"}</p>
              <div className="mcv-new-only overflow-hidden">
                {files.map(renderFile)}
              </div>
            </div>
            <div>
              <p className="p-2 border-b">{labels.result ?? "Result"}</p>
              <pre className="whitespace-pre-wrap break-words p-2">
                {JSON.stringify(mergedJson, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
