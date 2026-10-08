import {
  MergeConflictViewer,
  type MergeConflictViewerHandle,
  type MergeStatus,
} from "@mcv"
import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { type InitialResult, ViewerConfig } from "../components/ViewerConfig"
import { defaultExampleKey, examples } from "../data/examples"

export function Viewer() {
  const [selectedExample, setSelectedExample] =
    useState<string>(defaultExampleKey)
  const [layout, setLayout] = useState<
    "horizontal" | "vertical" | "responsive"
  >("responsive")
  const [height, setHeight] = useState<string>("600px")
  const [initialResult, setInitialResult] = useState<InitialResult>("none")
  const [editable, setEditable] = useState(true)
  const [collapseUnchanged, setCollapseUnchanged] = useState(false)

  const viewerRef = useRef<MergeConflictViewerHandle>(null)
  const [status, setStatus] = useState<MergeStatus | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  const example = examples[selectedExample]
  const initialMergedJson =
    initialResult === "current"
      ? example.current
      : initialResult === "incoming"
        ? example.incoming
        : undefined

  return (
    <div className="m-6 mx-16 min-h-[calc(100vh-132px)] flex flex-col gap-6">
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

      <MergeConflictViewer
        key={`${selectedExample}-${initialResult}-${collapseUnchanged}`}
        ref={viewerRef}
        currentJson={example.current}
        incomingJson={example.incoming}
        initialMergedJson={initialMergedJson}
        layout={layout}
        height={height}
        editable={editable}
        collapseUnchanged={collapseUnchanged}
        onMergeChange={(_merged, next) => {
          setStatus(next)
          setSaved(null)
        }}
      />

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <Button
            disabled={!status?.allResolved}
            onClick={() =>
              setSaved(JSON.stringify(viewerRef.current?.getResult(), null, 2))
            }
          >
            Save merge
          </Button>
          <span className="text-sm text-muted-foreground">
            {status?.allResolved
              ? "Everything is resolved, so saving is safe."
              : `Disabled until every change is decided (${status?.unresolved ?? 0} left).`}
          </span>
        </div>
        {saved && (
          <pre className="max-h-80 overflow-auto rounded-md border p-3 text-xs">
            {saved}
          </pre>
        )}
      </div>
    </div>
  )
}
