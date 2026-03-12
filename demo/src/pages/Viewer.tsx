import { useState } from "react"
import { MergeConflictViewer } from "@/components/MergeConflictViewer"
import { ViewerConfig } from "../components/ViewerConfig"
import { defaultExampleKey, examples } from "../data/examples"

export function Viewer() {
  const [selectedExample, setSelectedExample] =
    useState<string>(defaultExampleKey)
  const [layout, setLayout] = useState<
    "horizontal" | "vertical" | "responsive"
  >("responsive")
  const [height, setHeight] = useState<string>("600px")
  const [initialResult, setInitialResult] = useState<"current" | "incoming">(
    "incoming",
  )

  const example = examples[selectedExample]

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
      />

      <p className="text-2xl font-medium">Merge Conflict Viewer</p>

      <MergeConflictViewer
        key={`${selectedExample}-${initialResult}`}
        currentJson={example.current}
        incomingJson={example.incoming}
        layout={layout}
        height={height}
        initialMergedJson={
          initialResult === "current" ? example.current : example.incoming
        }
      />
    </div>
  )
}
