import { Check, Copy } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function useCopy(text: string) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }
  return { copied, copy }
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const { copied, copy } = useCopy(text)
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={copy}
      aria-label={copied ? "Copied" : label}
      className="text-muted-foreground"
    >
      {copied ? <Check /> : <Copy />}
    </Button>
  )
}

/** A one-line shell command with a copy button. */
export function CopyCommand({
  command,
  className,
  wrap = false,
}: {
  command: string
  className?: string
  /** Break a long command over several lines instead of scrolling it. */
  wrap?: boolean
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border bg-card py-1.5 pr-1.5 pl-4 font-mono text-sm shadow-xs",
        className,
      )}
    >
      <span aria-hidden className="text-muted-foreground select-none">
        $
      </span>
      <code
        className={cn(
          "min-w-0 flex-1",
          wrap
            ? "py-1.5 break-all"
            : "overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        )}
      >
        {command}
      </code>
      <CopyButton text={command} label="Copy command" />
    </div>
  )
}

/** A small code listing with an optional file name and a copy button. */
export function CodeBlock({
  code,
  title,
  className,
}: {
  code: string
  title?: string
  className?: string
}) {
  return (
    <figure
      className={cn(
        "overflow-hidden rounded-lg border bg-card text-card-foreground",
        className,
      )}
    >
      <figcaption className="flex h-9 items-center justify-between border-b bg-muted/40 pr-1.5 pl-4 font-mono text-xs text-muted-foreground">
        <span>{title ?? " "}</span>
        <CopyButton text={code} label="Copy code" />
      </figcaption>
      <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed">
        <code>{code}</code>
      </pre>
    </figure>
  )
}
