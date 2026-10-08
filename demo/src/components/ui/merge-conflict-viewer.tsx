"use client"

import {
  type MergePane,
  type MergeViewer,
  type MergeViewerAction,
  type MergeViewerFold,
  type MergeViewerLine,
  MergeViewerProvider,
  type MergeViewerRow,
  type UseMergeViewerOptions,
  useMergeViewer,
  useMergeViewerContext,
} from "@ht-rnd/merge-conflict-viewer"
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
import * as React from "react"

import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

/*
 * Merge conflict viewer for shadcn/ui.
 *
 * The behaviour (merging, undo, navigation, folding, editing, grid placement)
 * lives in the headless `@ht-rnd/merge-conflict-viewer` package. This file only
 * decides how things look, so change anything here freely.
 *
 * Colours: the merge colours are the `--merge-*` variables added to your CSS by
 * the registry item; everything else uses your shadcn tokens (`background`,
 * `border`, `muted-foreground`, `primary`, `destructive`, ...). Fonts are
 * inherited, the code panes use `font-mono`.
 *
 * Works with Tailwind v3.4 and v4: arbitrary values carry an explicit type
 * (`bg-[color:var(--x)]`) and no v4-only syntax is used.
 */

// ---------------------------------------------------------------------------
// Look of the cells
// ---------------------------------------------------------------------------

interface Tint {
  bg: string
  rejectedBg: string
  border: string
  mark: string
  rejectedMark: string
}

// Written out in full so Tailwind can find every class.
const TINTS = {
  modified: {
    bg: "bg-[color:var(--merge-modified)]",
    rejectedBg:
      "bg-[color:color-mix(in_srgb,var(--merge-modified)_30%,transparent)]",
    border: "border-[color:var(--merge-modified-border)]",
    mark: "bg-[color:var(--merge-modified-highlight)]",
    rejectedMark:
      "bg-[color:color-mix(in_srgb,var(--merge-modified-highlight)_50%,transparent)]",
  },
  added: {
    bg: "bg-[color:var(--merge-added)]",
    rejectedBg:
      "bg-[color:color-mix(in_srgb,var(--merge-added)_30%,transparent)]",
    border: "border-[color:var(--merge-added-border)]",
    mark: "bg-[color:var(--merge-added-highlight)]",
    rejectedMark:
      "bg-[color:color-mix(in_srgb,var(--merge-added-highlight)_50%,transparent)]",
  },
  pending: {
    bg: "bg-[color:var(--merge-pending)]",
    rejectedBg: "bg-[color:var(--merge-pending)]",
    border: "border-[color:var(--merge-pending-border)]",
    mark: "bg-[color:var(--merge-pending-highlight)]",
    rejectedMark: "bg-[color:var(--merge-pending-highlight)]",
  },
  edited: {
    bg: "bg-[color:var(--merge-edited)]",
    rejectedBg: "bg-[color:var(--merge-edited)]",
    border: "border-[color:var(--merge-edited-border)]",
    mark: "bg-[color:var(--merge-edited-highlight)]",
    rejectedMark: "bg-[color:var(--merge-edited-highlight)]",
  },
  filler: {
    bg: "bg-[color:var(--merge-filler)] bg-[image:repeating-linear-gradient(135deg,transparent_0_5px,var(--merge-filler-stripe)_5px_6px)]",
    rejectedBg:
      "bg-[color:var(--merge-filler)] bg-[image:repeating-linear-gradient(135deg,transparent_0_5px,var(--merge-filler-stripe)_5px_6px)]",
    border: "border-[color:var(--merge-filler-stripe)]",
    mark: "",
    rejectedMark: "",
  },
} satisfies Record<string, Tint>

function tintFor(line: MergeViewerLine): {
  bg: string
  border: string
  mark: string
} | null {
  if (line.state === "unchanged" || line.kind === null) {
    return null
  }
  const rejected = line.state === "rejected"
  const key =
    line.state === "filler"
      ? "filler"
      : line.state === "pending"
        ? "pending"
        : line.state === "edited"
          ? "edited"
          : line.kind === "modified"
            ? "modified"
            : "added"
  const t = TINTS[key]
  return {
    bg: rejected ? t.rejectedBg : t.bg,
    border: line.active ? "border-primary" : t.border,
    mark: rejected ? t.rejectedMark : t.mark,
  }
}

type CellColumn = "code" | "actions" | "number"

function cellClassName(line: MergeViewerLine, column: CellColumn): string {
  const t = tintFor(line)
  return cn(
    "min-h-[1.55em]",
    column === "code" &&
      "min-w-0 px-2 whitespace-pre-wrap [overflow-wrap:anywhere]",
    column === "number" &&
      "px-1.5 text-right text-muted-foreground tabular-nums select-none",
    column === "actions" && "flex items-center justify-center gap-0.5",
    line.pane === "result" && column === "code" && "group relative",
    t && [
      t.bg,
      t.border,
      line.blockStart && "border-t",
      line.blockEnd && "border-b",
    ],
    line.state === "rejected" && column === "code" && "text-muted-foreground",
  )
}

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

type MergeConflictViewerDivProps = Omit<React.ComponentProps<"div">, "ref">

type MergeConflictViewerProps = MergeConflictViewerDivProps &
  (
    | {
        /** A viewer created with `useMergeViewer`, to read its state yourself. */
        viewer: MergeViewer
      }
    | (UseMergeViewerOptions & { viewer?: undefined })
  )

function MergeConflictViewerRoot({
  viewer,
  className,
  children,
  onKeyDown,
  ...props
}: MergeConflictViewerDivProps & { viewer: MergeViewer }) {
  const { ref, onKeyDown: undoShortcuts, ...rootProps } = viewer.getRootProps()

  return (
    <MergeViewerProvider viewer={viewer}>
      <TooltipProvider>
        {/* biome-ignore lint/a11y/useSemanticElements: a fieldset is for form controls; this is a widget that owns the undo shortcuts */}
        <div
          ref={ref}
          role="group"
          data-slot="merge-conflict-viewer"
          className={cn("flex min-h-0 flex-col gap-2", className)}
          {...rootProps}
          {...props}
          onKeyDown={(event) => {
            onKeyDown?.(event)
            if (!event.defaultPrevented) {
              undoShortcuts(event)
            }
          }}
        >
          {children ?? (
            <>
              <MergeConflictToolbar />
              <MergeConflictStatus />
              <MergeConflictPanes />
            </>
          )}
        </div>
      </TooltipProvider>
    </MergeViewerProvider>
  )
}

function MergeConflictViewerOwner({
  currentJson,
  incomingJson,
  initialMergedJson,
  startUnresolved,
  decisions,
  onDecisionsChange,
  onMergeChange,
  editable,
  labels,
  layout,
  stackBelow,
  collapseUnchanged,
  viewer: _viewer,
  ...rootProps
}: MergeConflictViewerDivProps &
  UseMergeViewerOptions & { viewer?: undefined }) {
  const viewer = useMergeViewer({
    currentJson,
    incomingJson,
    initialMergedJson,
    startUnresolved,
    decisions,
    onDecisionsChange,
    onMergeChange,
    editable,
    labels,
    layout,
    stackBelow,
    collapseUnchanged,
  })
  return <MergeConflictViewerRoot viewer={viewer} {...rootProps} />
}

/**
 * Compare two JSON documents and decide, change by change, what the result is.
 *
 * Without children it renders the toolbar, the status banner and the panes.
 * Pass children to arrange those parts yourself. Give it a height with
 * `className` (for example `h-[600px]`) and the panes scroll inside it.
 */
function MergeConflictViewer(props: MergeConflictViewerProps) {
  if (props.viewer) {
    return <MergeConflictViewerRoot {...props} viewer={props.viewer} />
  }
  return <MergeConflictViewerOwner {...props} />
}

// ---------------------------------------------------------------------------
// Toolbar
// ---------------------------------------------------------------------------

function ToolbarIconButton({
  label,
  tooltip = label,
  disabled,
  onClick,
  children,
}: {
  label: string
  tooltip?: string
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-8"
          aria-label={label}
          disabled={disabled}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  )
}

function MergeConflictToolbar({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  const viewer = useMergeViewerContext()
  const { labels: t, status } = viewer

  return (
    <div
      data-slot="merge-conflict-toolbar"
      className={cn("flex flex-wrap items-center gap-2", className)}
      {...props}
    >
      {children ?? (
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => viewer.applyAll("left")}
          >
            {t.applyAllCurrent}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => viewer.applyAll("right")}
          >
            {t.applyAllIncoming}
          </Button>

          <div className="flex gap-1">
            <ToolbarIconButton
              label={t.previousChange}
              disabled={status.total === 0}
              onClick={() => viewer.goToChange("previous")}
            >
              <ChevronUp className="size-4" />
            </ToolbarIconButton>
            <ToolbarIconButton
              label={t.nextChange}
              disabled={status.total === 0}
              onClick={() => viewer.goToChange("next")}
            >
              <ChevronDown className="size-4" />
            </ToolbarIconButton>
          </div>

          <div className="flex gap-1">
            <ToolbarIconButton
              label={t.undo}
              tooltip={`${t.undo} (Ctrl+Z)`}
              disabled={!viewer.canUndo}
              onClick={viewer.undo}
            >
              <Undo2 className="size-4" />
            </ToolbarIconButton>
            <ToolbarIconButton
              label={t.redo}
              tooltip={`${t.redo} (Ctrl+Shift+Z)`}
              disabled={!viewer.canRedo}
              onClick={viewer.redo}
            >
              <Redo2 className="size-4" />
            </ToolbarIconButton>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-pressed={viewer.collapsed}
            className="aria-pressed:bg-accent aria-pressed:text-accent-foreground"
            onClick={viewer.toggleCollapsed}
          >
            {t.hideUnchanged}
          </Button>

          <span className="ml-auto text-sm text-muted-foreground">
            {t.summary(status)}
          </span>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Status banner
// ---------------------------------------------------------------------------

const STATUS_STYLES = {
  empty: {
    box: "border-border bg-[color:var(--merge-filler)]",
    icon: "text-muted-foreground",
    Icon: Info,
  },
  pending: {
    box: "border-[color:var(--merge-pending-border)] bg-[color:var(--merge-pending)]",
    icon: "text-[color:var(--merge-warning-icon)]",
    Icon: CircleAlert,
  },
  resolved: {
    box: "border-[color:var(--merge-success-border)] bg-[color:var(--merge-success)]",
    icon: "text-[color:var(--merge-success-icon)]",
    Icon: CircleCheck,
  },
} as const

function MergeConflictStatus({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  const viewer = useMergeViewerContext()
  const { status, statusState, statusText, labels: t } = viewer
  const { box, icon, Icon } = STATUS_STYLES[statusState]

  return (
    <div
      data-slot="merge-conflict-status"
      data-state={statusState}
      className={cn(
        "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
        box,
        className,
      )}
      {...props}
    >
      {children ?? (
        <>
          <Icon className={cn("size-[18px] shrink-0", icon)} aria-hidden />
          <output className="min-w-0 flex-1">{statusText}</output>
          {status.total > 0 && (
            <Progress
              aria-hidden
              value={(status.resolved / status.total) * 100}
              className="h-1.5 w-24 shrink-0"
            />
          )}
          {statusState === "pending" && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => viewer.goToNextUnresolved()}
            >
              {t.nextUnresolved}
            </Button>
          )}
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Panes
// ---------------------------------------------------------------------------

const PANES: MergePane[] = ["current", "result", "incoming"]

function MergeConflictPanes({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const viewer = useMergeViewerContext()
  const { ref, ...scrollProps } = viewer.getScrollProps()

  return (
    <div
      ref={ref as React.Ref<HTMLDivElement>}
      data-slot="merge-conflict-panes"
      className={cn(
        "relative min-h-0 flex-1 overflow-auto rounded-lg border bg-background",
        className,
      )}
      {...scrollProps}
      {...props}
    >
      <div
        {...viewer.getGridProps()}
        className={cn(
          "font-mono text-[13px] leading-[1.55]",
          !viewer.stacked && "min-w-[60rem]",
        )}
      >
        {PANES.map((pane) => (
          <div
            key={pane}
            {...viewer.getHeaderProps(pane)}
            className={cn(
              "border-b bg-background px-3 py-2 font-sans text-sm font-medium",
              viewer.stacked
                ? "border-t first:border-t-0"
                : "sticky top-0 z-10",
            )}
          >
            {viewer.labels[pane]}
          </div>
        ))}

        {viewer.items.map((item) =>
          item.type === "row" ? (
            <MergeConflictRow key={item.key} item={item} />
          ) : (
            <MergeConflictFold key={item.key} item={item} />
          ),
        )}
      </div>
    </div>
  )
}

function CodeText({ line }: { line: MergeViewerLine }) {
  const markClass = tintFor(line)?.mark
  return (
    <>
      {line.segments.map((segment, index) =>
        segment.changed ? (
          <mark
            key={index}
            className={cn("rounded-[2px] text-inherit", markClass)}
          >
            {segment.text}
          </mark>
        ) : (
          <React.Fragment key={index}>{segment.text}</React.Fragment>
        ),
      )}
    </>
  )
}

function ActionButton({
  action,
  variant,
  children,
}: {
  action: MergeViewerAction
  variant: "accept" | "remove"
  children: React.ReactNode
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(
        "size-5 rounded-sm p-0 text-muted-foreground",
        action.pressed &&
          variant === "accept" &&
          "bg-primary/15 text-primary hover:bg-primary/25",
        action.pressed &&
          variant === "remove" &&
          "bg-destructive/15 text-destructive hover:bg-destructive/25",
      )}
      aria-label={action.label}
      aria-pressed={action.pressed}
      title={action.label}
      onClick={action.run}
    >
      {children}
    </Button>
  )
}

function MergeConflictRow({ item }: { item: MergeViewerRow }) {
  const viewer = useMergeViewerContext()
  const { current, result, incoming } = item

  const cell = (
    pane: MergePane,
    column: CellColumn,
    children?: React.ReactNode,
  ) => (
    <div
      {...viewer.getCellProps(item, pane, column)}
      className={cellClassName(item[pane], column)}
      aria-hidden={column === "number" ? true : undefined}
    >
      {children}
    </div>
  )

  return (
    <>
      {cell("current", "code", <CodeText line={current} />)}
      {cell(
        "current",
        "actions",
        <>
          {current.actions.remove && (
            <ActionButton action={current.actions.remove} variant="remove">
              <X className="size-3.5" />
            </ActionButton>
          )}
          {current.actions.accept && (
            <ActionButton action={current.actions.accept} variant="accept">
              <ChevronsRight className="size-3.5" />
            </ActionButton>
          )}
        </>,
      )}
      {cell("current", "number", current.lineNo)}

      {cell("result", "number", result.lineNo)}
      {cell(
        "result",
        "code",
        <>
          <CodeText line={result} />
          {(result.actions.revert || result.actions.edit) && (
            <div className="absolute top-0 right-1 z-[1] flex gap-0.5 opacity-50 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
              {result.actions.revert && (
                <ActionButton action={result.actions.revert} variant="accept">
                  <Undo2 className="size-3.5" />
                </ActionButton>
              )}
              {result.actions.edit && (
                <ActionButton action={result.actions.edit} variant="accept">
                  <Pencil className="size-3.5" />
                </ActionButton>
              )}
            </div>
          )}
          {result.editor && result.blockId && (
            <MergeConflictValueEditor
              blockId={result.blockId}
              editor={result.editor}
            />
          )}
        </>,
      )}

      {cell("incoming", "number", incoming.lineNo)}
      {cell(
        "incoming",
        "actions",
        <>
          {incoming.actions.accept && (
            <ActionButton action={incoming.actions.accept} variant="accept">
              <ChevronsLeft className="size-3.5" />
            </ActionButton>
          )}
          {incoming.actions.remove && (
            <ActionButton action={incoming.actions.remove} variant="remove">
              <X className="size-3.5" />
            </ActionButton>
          )}
        </>,
      )}
      {cell("incoming", "code", <CodeText line={incoming} />)}
    </>
  )
}

function MergeConflictFold({ item }: { item: MergeViewerFold }) {
  const viewer = useMergeViewerContext()

  return (
    <>
      {PANES.map((pane) => (
        <button
          key={pane}
          {...viewer.getFoldProps(item, pane)}
          className="flex items-center justify-center border-y border-dashed bg-[color:var(--merge-filler)] px-2 py-0.5 font-sans text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
        >
          ⋯ {item.label}
        </button>
      ))}
    </>
  )
}

// ---------------------------------------------------------------------------
// Value editor
// ---------------------------------------------------------------------------

/** Inline JSON editor for the value of one change in the result. */
function MergeConflictValueEditor({
  blockId,
  editor,
}: {
  blockId: string
  editor: NonNullable<MergeViewerLine["editor"]>
}) {
  const viewer = useMergeViewerContext()
  const t = viewer.labels
  const [text, setText] = React.useState(editor.initialText)
  const [error, setError] = React.useState<string | null>(null)
  const inputRef = React.useRef<HTMLTextAreaElement>(null)

  React.useEffect(() => {
    // Hand focus back to the pencil button when the editor closes.
    const opener = document.activeElement
    inputRef.current?.focus()
    inputRef.current?.select()
    return () => {
      if (opener instanceof HTMLElement && opener.isConnected) {
        opener.focus()
      }
    }
  }, [])

  const submit = () => {
    setError(viewer.commitEdit(blockId, text))
  }

  return (
    <div
      data-slot="merge-conflict-value-editor"
      className="absolute inset-x-0 top-0 z-30 flex flex-col gap-2 rounded-md border border-primary bg-popover p-2 font-sans text-sm whitespace-normal text-popover-foreground shadow-lg"
    >
      <span className="text-xs text-muted-foreground">{editor.title}</span>
      <Textarea
        ref={inputRef}
        value={text}
        rows={Math.min(Math.max(text.split("\n").length, 3), 14)}
        spellCheck={false}
        aria-label={editor.inputLabel}
        aria-invalid={error !== null}
        className="min-h-0 resize-y font-mono text-xs whitespace-pre"
        onChange={(event) => {
          setText(event.target.value)
          setError(null)
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault()
            viewer.cancelEdit()
          } else if (
            event.key === "Enter" &&
            (event.ctrlKey || event.metaKey)
          ) {
            event.preventDefault()
            submit()
          }
        }}
      />
      {error && (
        <span role="alert" className="text-xs text-destructive">
          {error}
        </span>
      )}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={viewer.cancelEdit}
        >
          {t.cancel}
        </Button>
        <Button type="button" size="sm" onClick={submit}>
          {t.apply}
        </Button>
      </div>
    </div>
  )
}

export {
  MergeConflictViewer,
  MergeConflictToolbar,
  MergeConflictStatus,
  MergeConflictPanes,
  MergeConflictValueEditor,
  type MergeConflictViewerProps,
}
