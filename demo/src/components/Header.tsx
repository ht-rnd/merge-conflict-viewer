import { Github, GitMerge, Moon, Package, Sun } from "lucide-react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { Theme } from "../types"

interface HeaderProps {
  theme: Theme
  onThemeChange: (theme: Theme) => void
}

export function Header({ theme, onThemeChange }: HeaderProps) {
  return (
    <div className="border-b border-input sticky top-0 p-4 px-16 flex items-center justify-between bg-background z-[1]">
      <Link to="/" className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
          <GitMerge className="w-6 h-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Merge Conflict Viewer</h1>
          <p className="text-sm text-muted-foreground">
            Interactive • React • TypeScript
          </p>
        </div>
      </Link>

      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" asChild>
              <a
                href="https://www.npmjs.com/package/@ht-rnd/merge-conflict-viewer"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Package className="w-5 h-5" />
              </a>
            </Button>
          </TooltipTrigger>
          <TooltipContent>npm package</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" asChild>
              <a
                href="https://github.com/ht-rnd/merge-conflict-viewer"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Github className="w-5 h-5" />
              </a>
            </Button>
          </TooltipTrigger>
          <TooltipContent>GitHub</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() =>
                onThemeChange(theme === "light" ? "dark" : "light")
              }
              aria-label="Toggle theme"
            >
              {theme === "light" ? (
                <Moon className="w-5 h-5" />
              ) : (
                <Sun className="w-5 h-5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Toggle theme</TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}
