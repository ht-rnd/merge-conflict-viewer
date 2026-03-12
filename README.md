# Merge Conflict Viewer

A React component for viewing and resolving JSON merge conflicts with an intuitive diff interface.

## Features

- **Diff viewing** — Compare two JSON objects with clear visual differences
- **Interactive conflict resolution** — Choose which version to keep for each conflicting field
- **Field deletion** — Remove unwanted fields from the merged result
- **Bulk operations** — Apply all changes from one side with a single click
- **Customizable** — Configure labels, layout, and container height
- **Real-time preview** — See the merged result update instantly

## Setup

### Prerequisites

- React app with TypeScript
- Tailwind CSS configured
- shadcn/ui initialized (`components.json`, `cn` utility, CSS variables)
- `@/` path alias pointing to `src/`

### 1. Add shadcn/ui components

```bash
npx shadcn@latest add button tooltip
```

### 2. Copy `MergeConflictViewer.tsx`

Copy [`src/components/MergeConflictViewer.tsx`](src/components/MergeConflictViewer.tsx) into your `src/components/` folder.

### 3. Copy the `unidiff` type declaration

Copy [`src/types/unidiff.d.ts`](src/types/unidiff.d.ts) into your `src/types/` folder. This file provides TypeScript types for the `unidiff` package, which ships without official type definitions.

### 4. Install npm dependencies

```bash
npm install deep-diff react-diff-view unidiff lucide-react clsx tailwind-merge class-variance-authority radix-ui
npm install --save-dev @types/deep-diff
```

## Usage

### Basic

```tsx
import { MergeConflictViewer } from "@/components/MergeConflictViewer";

const currentData = {
  name: "John Doe",
  age: 30,
  city: "New York",
};

const incomingData = {
  name: "John Doe",
  age: 31,
  city: "San Francisco",
};

function App() {
  return (
    <MergeConflictViewer
      currentJson={currentData}
      incomingJson={incomingData}
    />
  );
}
```

### With callback

```tsx
import { MergeConflictViewer } from "@/components/MergeConflictViewer";
import type { JsonObject } from "@/components/MergeConflictViewer";

function App() {
  const handleMergeChange = (mergedJson: JsonObject) => {
    console.log("Merged result:", mergedJson);
  };

  return (
    <MergeConflictViewer
      currentJson={currentData}
      incomingJson={incomingData}
      onMergeChange={handleMergeChange}
    />
  );
}
```

### With all props

```tsx
<MergeConflictViewer
  currentJson={currentData}
  incomingJson={incomingData}
  initialMergedJson={currentData}
  onMergeChange={(merged) => console.log(merged)}
  labels={{
    current: "My Version",
    incoming: "Their Version",
    result: "Final Result",
  }}
  buttonLabels={{
    applyAllCurrent: "Keep All Mine",
    applyAllIncoming: "Accept All Theirs",
  }}
  height="600px"
  layout="horizontal"
/>
```

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `currentJson` | `JsonObject` | Yes | — | The "current" / left JSON object |
| `incomingJson` | `JsonObject` | Yes | — | The "incoming" / right JSON object |
| `onMergeChange` | `(mergedJson: JsonObject) => void` | No | — | Fired when the merged result changes |
| `initialMergedJson` | `JsonObject` | No | `incomingJson` | Starting value for the result pane |
| `labels` | `{ current?: string; incoming?: string; result?: string }` | No | `"Current"` / `"Incoming"` / `"Result"` | Column header labels |
| `buttonLabels` | `{ applyAllCurrent?: string; applyAllIncoming?: string }` | No | `"Apply all from current"` / `"Apply all from incoming"` | Bulk-action button labels |
| `height` | `string \| number` | No | — | Height of the diff container |
| `layout` | `"horizontal" \| "vertical" \| "responsive"` | No | `"responsive"` | Pane layout. `"responsive"` is horizontal on `md+`, vertical on smaller screens |

## How It Works

- **Deep diff** — `deep-diff` detects which keys differ between the two objects
- **Unified diff** — `unidiff` generates a unified diff for line-by-line display
- **Interactive UI** — `react-diff-view` renders the split diff; gutter buttons let you accept or delete each change
- **Result pane** — tracks your selections and shows the merged JSON in real-time

## Run the Demo

```bash
cd demo
npm install
npm run dev
```

## License

Apache-2.0

## Credits

- [react-diff-view](https://github.com/otakustay/react-diff-view)
- [deep-diff](https://github.com/flitbit/diff)
- [unidiff](https://github.com/sergeyt/unidiff)
- [Tailwind CSS](https://tailwindcss.com/)
- [Radix UI](https://www.radix-ui.com/) / [shadcn/ui](https://ui.shadcn.com/)
