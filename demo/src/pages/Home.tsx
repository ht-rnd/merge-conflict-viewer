import { Link } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Features } from "../components/Features"

export function Home() {
  return (
    <div className="m-6 min-h-[calc(100vh-132px)] flex flex-col items-center justify-center">
      <h2 className="text-6xl font-bold text-primary text-center">
        Resolve JSON Conflicts Your Way
      </h2>

      <p className="m-6 max-w-[48rem] text-lg text-muted-foreground text-center">
        A React component for viewing and resolving JSON merge conflicts.
        Compare two JSON objects side-by-side, choose which values to keep, and
        preview the merged result in real-time.
      </p>

      <div className="flex flex-wrap gap-3 justify-center mb-6">
        <Badge variant="secondary">Side-by-side Diff</Badge>
        <Badge variant="secondary">TypeScript</Badge>
        <Badge variant="secondary">Interactive</Badge>
        <Badge variant="secondary">Bulk Ops</Badge>
      </div>

      <Features />

      <Button asChild className="mt-6">
        <Link to="/viewer">Try it out</Link>
      </Button>
    </div>
  )
}
