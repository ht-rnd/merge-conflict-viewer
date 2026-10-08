import { useMergeViewer } from "@ht-rnd/merge-conflict-viewer"
import {
  MergeConflictPanes,
  MergeConflictStatus,
  MergeConflictViewer,
} from "@/components/ui/merge-conflict-viewer"

const current = { name: "api", retries: 3, region: "eu", tags: ["a", "b"] }
const incoming = { name: "api", retries: 5, region: "us", flags: ["beta"] }

/** Owns its state: documents in, merged result out. */
function Simple() {
  return (
    <MergeConflictViewer
      className="h-[500px]"
      currentJson={current}
      incomingJson={incoming}
      editable
      collapseUnchanged
      onMergeChange={(merged, status) => {
        console.log(merged, status.allResolved)
      }}
    />
  )
}

/** The page owns the viewer and arranges the parts itself. */
function Composed() {
  const viewer = useMergeViewer({
    currentJson: current,
    incomingJson: incoming,
  })
  return (
    <MergeConflictViewer viewer={viewer} className="h-[400px]">
      <MergeConflictStatus />
      <MergeConflictPanes />
      <button type="button" disabled={!viewer.status.allResolved}>
        Save
      </button>
    </MergeConflictViewer>
  )
}

export function App() {
  return (
    <div className="flex flex-col gap-8 p-4">
      <Simple />
      <Composed />
    </div>
  )
}
