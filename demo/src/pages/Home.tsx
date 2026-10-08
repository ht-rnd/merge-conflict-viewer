import {
  ArrowRight,
  Blocks,
  Braces,
  GitCompare,
  MousePointerClick,
  Palette,
  ShieldCheck,
} from "lucide-react"
import { type CSSProperties, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MergeConflictViewer } from "@/components/ui/merge-conflict-viewer"
import { cn } from "@/lib/utils"
import { useTheme } from "../App"
import { CodeBlock, CopyCommand } from "../components/Code"

const INSTALL =
  "npx shadcn add ht-rnd/merge-conflict-viewer/merge-conflict-viewer"

// A small service config with one of every kind of change: edited values, a key
// removed, a nested value, an array item and a key that only exists on one side.
const current = {
  name: "checkout-api",
  replicas: 2,
  region: "eu-west-1",
  logLevel: "info",
  cache: { ttl: 60, enabled: true },
  flags: ["beta-ui"],
}
const incoming = {
  name: "checkout-api",
  replicas: 4,
  region: "eu-central-1",
  cache: { ttl: 300, enabled: true },
  flags: ["beta-ui", "new-cart"],
  timeoutSeconds: 30,
}

// ---------------------------------------------------------------------------
// "Make it yours": the same variables a user would set in their own CSS.
// ---------------------------------------------------------------------------

interface ColourScheme {
  id: string
  label: string
  light: Record<string, string>
  dark: Record<string, string>
}

const PALETTES: ColourScheme[] = [
  {
    id: "default",
    label: "Default",
    light: {
      "--merge-modified": "#dce8fd",
      "--merge-modified-border": "#a4c0f2",
      "--merge-modified-highlight": "#b3cdfa",
      "--merge-added": "#dcf1e1",
      "--merge-added-border": "#9bd2a9",
      "--merge-added-highlight": "#b0e0bc",
    },
    dark: {
      "--merge-modified": "#25344f",
      "--merge-modified-border": "#3b5587",
      "--merge-modified-highlight": "#36507d",
      "--merge-added": "#1d3a28",
      "--merge-added-border": "#2e6a45",
      "--merge-added-highlight": "#2a5c3d",
    },
  },
  {
    id: "violet",
    label: "Violet",
    light: {
      "--merge-modified": "#ede9fe",
      "--merge-modified-border": "#c4b5fd",
      "--merge-modified-highlight": "#ddd6fe",
      "--merge-added": "#ccfbf1",
      "--merge-added-border": "#5eead4",
      "--merge-added-highlight": "#99f6e4",
    },
    dark: {
      "--merge-modified": "#2e2750",
      "--merge-modified-border": "#5b4fa0",
      "--merge-modified-highlight": "#46397d",
      "--merge-added": "#12352f",
      "--merge-added-border": "#1f6b5d",
      "--merge-added-highlight": "#1a5247",
    },
  },
  {
    id: "rose",
    label: "Rose",
    light: {
      "--merge-modified": "#ffe4e6",
      "--merge-modified-border": "#fda4af",
      "--merge-modified-highlight": "#fecdd3",
      "--merge-added": "#fef9c3",
      "--merge-added-border": "#fde047",
      "--merge-added-highlight": "#fef08a",
    },
    dark: {
      "--merge-modified": "#4a2128",
      "--merge-modified-border": "#8a3b46",
      "--merge-modified-highlight": "#6b2b35",
      "--merge-added": "#3d3510",
      "--merge-added-border": "#7a6a1c",
      "--merge-added-highlight": "#5c500f",
    },
  },
  {
    id: "mono",
    label: "Mono",
    light: {
      "--merge-modified": "#e5e5e5",
      "--merge-modified-border": "#a3a3a3",
      "--merge-modified-highlight": "#d4d4d4",
      "--merge-added": "#f5f5f5",
      "--merge-added-border": "#d4d4d4",
      "--merge-added-highlight": "#e5e5e5",
    },
    dark: {
      "--merge-modified": "#333333",
      "--merge-modified-border": "#666666",
      "--merge-modified-highlight": "#4a4a4a",
      "--merge-added": "#262626",
      "--merge-added-border": "#525252",
      "--merge-added-highlight": "#3a3a3a",
    },
  },
]

const RADII = [
  { id: "sharp", label: "Sharp", value: "0rem" },
  { id: "default", label: "Default", value: "0.625rem" },
  { id: "round", label: "Round", value: "1.25rem" },
]

function Choice({
  label,
  pressed,
  onClick,
  children,
}: {
  label: string
  pressed: boolean
  onClick: () => void
  children?: React.ReactNode
}) {
  return (
    <Button
      type="button"
      variant={pressed ? "secondary" : "ghost"}
      size="sm"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(pressed && "shadow-xs")}
    >
      {children}
      {label}
    </Button>
  )
}

function LiveViewer() {
  const { theme } = useTheme()
  const [paletteId, setPaletteId] = useState("default")
  const [radiusId, setRadiusId] = useState("default")

  const palette = PALETTES.find((p) => p.id === paletteId) ?? PALETTES[0]
  const radius = RADII.find((r) => r.id === radiusId) ?? RADII[1]

  const style = useMemo(
    () =>
      ({
        ...palette[theme],
        "--radius": radius.value,
      }) as CSSProperties,
    [palette, theme, radius],
  )

  return (
    <div className="flex flex-col gap-4" style={style}>
      <MergeConflictViewer
        currentJson={current}
        incomingJson={incoming}
        editable
        className="h-[460px]"
      />

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
        <div className="flex items-center gap-1">
          <span className="mr-2 text-muted-foreground">Colours</span>
          {PALETTES.map((p) => (
            <Choice
              key={p.id}
              label={p.label}
              pressed={p.id === paletteId}
              onClick={() => setPaletteId(p.id)}
            >
              <span
                aria-hidden
                className="flex overflow-hidden rounded-full border"
              >
                <span
                  className="size-3"
                  style={{ background: p[theme]["--merge-modified-border"] }}
                />
                <span
                  className="size-3"
                  style={{ background: p[theme]["--merge-added-border"] }}
                />
              </span>
            </Choice>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <span className="mr-2 text-muted-foreground">Corners</span>
          {RADII.map((r) => (
            <Choice
              key={r.id}
              label={r.label}
              pressed={r.id === radiusId}
              onClick={() => setRadiusId(r.id)}
            />
          ))}
        </div>

        <p className="text-muted-foreground sm:ml-auto">
          Set with <code className="font-mono text-xs">--merge-*</code> and{" "}
          <code className="font-mono text-xs">--radius</code>, the variables
          your own CSS uses.
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

const FEATURES = [
  {
    icon: GitCompare,
    title: "Compares structure, not lines",
    text: "Keys and array items are matched, so a key that exists on one side gets blank space opposite it instead of lining up with the wrong one.",
  },
  {
    icon: MousePointerClick,
    title: "One decision per change",
    text: "Accept current, accept incoming, remove it, or type your own value. Undo and redo up to 100 steps.",
  },
  {
    icon: ShieldCheck,
    title: "Knows when it is safe to save",
    text: "A status tells you when every change is decided. Disable Save until then, or restore a half-finished merge from a saved draft.",
  },
  {
    icon: Palette,
    title: "Uses your design system",
    text: "Your shadcn tokens, your font and your dark mode. The diff colours are a few CSS variables with built-in defaults.",
  },
  {
    icon: Blocks,
    title: "Composable parts",
    text: "Toolbar, status banner, panes and value editor. Arrange them, drop the ones you do not need, or edit the file.",
  },
  {
    icon: Braces,
    title: "Headless core on npm",
    text: "The merge logic is a hook and plain functions with no CSS. Run it in Node, or build a UI that is not shadcn.",
  },
]

const USE_IT = `import { MergeConflictViewer } from "@/components/ui/merge-conflict-viewer"

export function ResolveConfig({ current, incoming, onSave }) {
  return (
    <MergeConflictViewer
      currentJson={current}
      incomingJson={incoming}
      onMergeChange={(merged, status) => {
        if (status.allResolved) onSave(merged)
      }}
      className="h-[600px]"
    />
  )
}`

const THEME_IT = `/* globals.css: added for you by the install command */
:root {
  --merge-modified: #dce8fd;
  --merge-added: #dcf1e1;
}
.dark {
  --merge-modified: #25344f;
  --merge-added: #1d3a28;
}`

function Step({
  n,
  title,
  text,
  children,
}: {
  n: number
  title: string
  text: string
  children: React.ReactNode
}) {
  return (
    <li className="grid gap-4 border-t py-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] md:gap-10">
      <div className="flex gap-4">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full border font-mono text-xs text-muted-foreground">
          {n}
        </span>
        <div>
          <h3 className="font-medium">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{text}</p>
        </div>
      </div>
      <div className="min-w-0">{children}</div>
    </li>
  )
}

export function Home() {
  return (
    <main className="mx-auto max-w-6xl px-6">
      {/* Hero */}
      <section className="flex flex-col items-start gap-5 pt-10 pb-10 md:pt-14">
        <Badge variant="outline" className="gap-1.5 font-mono font-normal">
          shadcn/ui component
          <span aria-hidden className="text-muted-foreground">
            ·
          </span>
          Tailwind v3.4 and v4
        </Badge>

        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance md:text-6xl">
          Resolve JSON conflicts in your own design system.
        </h1>

        <p className="max-w-2xl text-lg text-muted-foreground text-pretty">
          Compare two JSON documents and decide every change. The component is
          copied into your repo, so it uses your tokens and fonts, and it tells
          you when the result is safe to save.
        </p>

        <CopyCommand command={INSTALL} wrap className="w-full max-w-2xl" />

        <div className="flex flex-wrap items-center gap-3">
          <Button asChild size="lg">
            <Link to="/viewer">
              Open the playground
              <ArrowRight />
            </Link>
          </Button>
          <Button asChild variant="ghost" size="lg">
            <a
              href="https://github.com/ht-rnd/merge-conflict-viewer"
              target="_blank"
              rel="noopener noreferrer"
            >
              Read the docs
            </a>
          </Button>
        </div>
      </section>

      {/* The real component */}
      <section aria-labelledby="live" className="pb-20">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="live" className="text-sm font-medium">
            This is the component, running on this page
          </h2>
          <p className="text-sm text-muted-foreground">
            Click » or « next to a change to decide it. Try the pencil in the
            Result pane.
          </p>
        </div>
        <LiveViewer />
      </section>

      {/* What it does */}
      <section aria-labelledby="features" className="pb-20">
        <h2
          id="features"
          className="mb-8 text-2xl font-semibold tracking-tight"
        >
          What you get
        </h2>
        <div className="grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex flex-col gap-3 bg-background p-6">
              <Icon className="size-5 text-muted-foreground" />
              <h3 className="font-medium">{title}</h3>
              <p className="text-sm text-muted-foreground text-pretty">
                {text}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* How to use it */}
      <section aria-labelledby="start" className="pb-24">
        <h2 id="start" className="mb-2 text-2xl font-semibold tracking-tight">
          Add it to your app
        </h2>
        <p className="mb-6 max-w-2xl text-muted-foreground">
          Requires a project that already uses shadcn/ui. The command also
          installs{" "}
          <code className="font-mono text-sm whitespace-nowrap">
            @ht-rnd/merge-conflict-viewer
          </code>
          , the headless package the component is built on.
        </p>

        <ol>
          <Step
            n={1}
            title="Install"
            text="Writes the component, adds the shadcn parts it uses and the colour variables."
          >
            <CopyCommand command={INSTALL} wrap />
          </Step>
          <Step
            n={2}
            title="Use it"
            text="Give it two documents and a height. The panes scroll inside."
          >
            <CodeBlock code={USE_IT} title="app/resolve-config.tsx" />
          </Step>
          <Step
            n={3}
            title="Make it yours"
            text="Change the variables, override them on one viewer, or edit the component file."
          >
            <CodeBlock code={THEME_IT} title="globals.css" />
          </Step>
        </ol>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t py-8 text-sm text-muted-foreground">
        <span>Apache-2.0 · @ht-rnd/merge-conflict-viewer</span>
        <a
          href="https://github.com/ht-rnd/merge-conflict-viewer"
          target="_blank"
          rel="noopener noreferrer"
          className="underline-offset-4 hover:text-foreground hover:underline"
        >
          Source and docs on GitHub
        </a>
      </footer>
    </main>
  )
}
