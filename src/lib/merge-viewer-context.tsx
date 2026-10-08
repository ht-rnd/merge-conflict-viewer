import { createContext, type ReactNode, useContext } from "react"
import type { MergeViewer } from "./use-merge-viewer"

const MergeViewerContext = createContext<MergeViewer | null>(null)

/** Shares one `useMergeViewer` instance with the parts of a custom viewer. */
export function MergeViewerProvider({
  viewer,
  children,
}: {
  viewer: MergeViewer
  children?: ReactNode
}) {
  return (
    <MergeViewerContext.Provider value={viewer}>
      {children}
    </MergeViewerContext.Provider>
  )
}

/** The viewer of the closest `MergeViewerProvider`. */
export function useMergeViewerContext(): MergeViewer {
  const viewer = useContext(MergeViewerContext)
  if (!viewer) {
    throw new Error(
      "useMergeViewerContext must be used inside a MergeViewerProvider",
    )
  }
  return viewer
}
