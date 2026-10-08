import { useMergeViewer } from "@ht-rnd/merge-conflict-viewer"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  MergeConflictPanes,
  MergeConflictStatus,
  MergeConflictToolbar,
  MergeConflictViewer,
} from "@/components/ui/merge-conflict-viewer"
import { type InitialResult, ViewerConfig } from "../components/ViewerConfig"
import { defaultExampleKey, examples } from "../data/examples"

type Layout = "horizontal" | "vertical" | "responsive"

export function Viewer() {
  const [selectedExample, setSelectedExample] =
    useState<string>(defaultExampleKey)
  const [layout, setLayout] = useState<Layout>("responsive")
  const [height, setHeight] = useState<string>("600px")
  const [initialResult, setInitialResult] = useState<InitialResult>("none")
  const [editable, setEditable] = useState(true)
  const [collapseUnchanged, setCollapseUnchanged] = useState(false)

  const example = examples[selectedExample]
  const initialMergedJson =
    initialResult === "current"
      ? example.current
      : initialResult === "incoming"
        ? example.incoming
        : undefined

  return (
    <div className="mx-auto flex min-h-[calc(100vh-132px)] max-w-6xl flex-col gap-6 px-6 py-8">
      <ViewerConfig
        selectedExample={selectedExample}
        onExampleChange={setSelectedExample}
        layout={layout}
        onLayoutChange={setLayout}
        height={height}
        onHeightChange={setHeight}
        initialMerged={initialResult}
        onInitialMergedChange={setInitialResult}
        editable={editable}
        onEditableChange={setEditable}
        collapseUnchanged={collapseUnchanged}
        onCollapseUnchangedChange={setCollapseUnchanged}
      />

      <p className="text-2xl font-medium">Merge Conflict Viewer</p>

      <ResolveAndSave
        key={`${selectedExample}-${initialResult}-${collapseUnchanged}`}
        current={example.current}
        incoming={example.incoming}
        initialMergedJson={initialMergedJson}
        layout={layout}
        height={height}
        editable={editable}
        collapseUnchanged={collapseUnchanged}
      />

      <Composition />
    </div>
  )
}

/**
 * The viewer plus a save button that stays disabled until every change is
 * decided. The hook is called here, so the page can read the merge state.
 */
function ResolveAndSave({
  current,
  incoming,
  initialMergedJson,
  layout,
  height,
  editable,
  collapseUnchanged,
}: {
  current: Record<string, unknown>
  incoming: Record<string, unknown>
  initialMergedJson?: Record<string, unknown>
  layout: Layout
  height: string
  editable: boolean
  collapseUnchanged: boolean
}) {
  const viewer = useMergeViewer({
    currentJson: current,
    incomingJson: incoming,
    initialMergedJson,
    layout,
    editable,
    collapseUnchanged,
  })
  const [saved, setSaved] = useState<string | null>(null)

  return (
    <>
      <MergeConflictViewer viewer={viewer} style={{ height }} />

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <Button
            disabled={!viewer.status.allResolved}
            onClick={() => setSaved(JSON.stringify(viewer.merged, null, 2))}
          >
            Save merge
          </Button>
          <span className="text-sm text-muted-foreground">
            {viewer.status.allResolved
              ? "Everything is resolved, so saving is safe."
              : `Disabled until every change is decided (${viewer.status.unresolved} left).`}
          </span>
        </div>
        {saved && (
          <pre className="max-h-80 overflow-auto rounded-md border p-3 text-xs">
            {saved}
          </pre>
        )}
      </div>
    </>
  )
}

const small = {
  current: { name: "api", retries: 3, region: "eu", debug: true },
  incoming: { name: "api", retries: 5, region: "us", flags: ["beta"] },
}

/** The same parts, arranged differently: status first, no toolbar. */
function Composition() {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-2xl font-medium">Composition</p>
      <p className="text-sm text-muted-foreground">
        Pass children to arrange the parts yourself: here the status banner sits
        above the panes and there is no toolbar. Colours come from the theme
        variables, so overriding them re-themes just this viewer.
      </p>
      <MergeConflictViewer
        currentJson={small.current}
        incomingJson={small.incoming}
        layout="vertical"
        className="h-96 [--merge-modified:#fde2e4] [--merge-modified-border:#f4a3ad] [--merge-modified-highlight:#f9c0c7] dark:[--merge-modified:#4a2128] dark:[--merge-modified-border:#8a3b46] dark:[--merge-modified-highlight:#6b2b35]"
      >
        <MergeConflictStatus />
        <MergeConflictPanes />
      </MergeConflictViewer>

      <MergeConflictViewer
        currentJson={small.current}
        incomingJson={small.incoming}
        collapseUnchanged
        className="h-96"
      >
        <MergeConflictToolbar />
        <MergeConflictPanes />
      </MergeConflictViewer>
    </div>
  )
}
