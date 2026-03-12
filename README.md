# Merge Conflict Viewer

A React component for viewing and resolving JSON merge conflicts with an intuitive diff interface.

## Features

- **Diff viewing** - Compare two JSON objects with clear visual differences
- **Interactive conflict resolution** - Choose which version to keep for each conflicting field
- **Field deletion** - Remove unwanted fields from the merged result
- **Bulk operations** - Apply all changes from one side with a single click
- **Customizable** - Configure labels and container height
- **TypeScript support** - Fully typed API for better development experience
- **Real-time preview** - See the merged result update instantly

## Installation

```bash
npm install @ht-rnd/merge-conflict-viewer
```

### Peer Dependencies

```bash
npm install react react-dom
```

Make sure you have Tailwind CSS configured in your project, as this library uses Tailwind utility classes.

## Usage

### Basic Example

```tsx
import { MergeConflictViewer } from "@ht-rnd/merge-conflict-viewer";
import "@ht-rnd/merge-conflict-viewer/styles"; // Import styles

const currentData = {
  name: "John Doe",
  age: 30,
  city: "New York"
};

const incomingData = {
  name: "John Doe",
  age: 31,
  city: "San Francisco"
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

### With Custom Labels and Callback

```tsx
import { MergeConflictViewer } from "@ht-rnd/merge-conflict-viewer";
import type { JsonObject } from "@ht-rnd/merge-conflict-viewer";

function App() {
  const handleMergeChange = (mergedJson: JsonObject) => {
    console.log("Merged result:", mergedJson);
  };

  return (
    <MergeConflictViewer
      currentJson={currentData}
      incomingJson={incomingData}
      onMergeChange={handleMergeChange}
      labels={{
        current: "My Version",
        incoming: "Their Version",
        result: "Final Result"
      }}
      buttonLabels={{
        applyAllCurrent: "Keep All Mine",
        applyAllIncoming: "Accept All Theirs"
      }}
      height="600px"
    />
  );
}
```

## API Reference

### MergeConflictViewerProps

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `currentJson` | `JsonObject` | Yes | - | The "current" or "left" JSON object to compare |
| `incomingJson` | `JsonObject` | Yes | - | The "incoming" or "right" JSON object to compare |
| `onMergeChange` | `(mergedJson: JsonObject) => void` | No | - | Callback fired when the merged result changes |
| `initialMergedJson` | `JsonObject` | No | `incomingJson` | Initial merged JSON (defaults to incomingJson) |
| `labels` | `{ current?: string; incoming?: string; result?: string }` | No | `{ current: "Current", incoming: "Incoming", result: "Result" }` | Custom labels for the three columns |
| `buttonLabels` | `{ applyAllCurrent?: string; applyAllIncoming?: string }` | No | See below | Custom button labels |
| `height` | `string \| number` | No | - | Height of the diff viewer container |
| `layout` | `"horizontal" \| "vertical" \| "responsive"` | No | `"responsive"` | Pane layout mode |

**Default Button Labels:**
- `applyAllCurrent`: `"Apply all from current"`
- `applyAllIncoming`: `"Apply all from incoming"`

### Type Exports

```typescript
import type {
  MergeConflictViewerProps,
  JsonObject,
  SideSelection,
  DiffSide
} from "@ht-rnd/merge-conflict-viewer";

// JsonObject: Record<string, unknown>
// SideSelection: "left" | "right" | "deleted"
// DiffSide: "left" | "right"
```

## Styling

This library uses Tailwind CSS for styling. Make sure you have Tailwind CSS configured in your project. The component also imports CSS from `react-diff-view` for the diff syntax highlighting.

## How It Works

1. **Deep Diff Analysis**: The component uses `deep-diff` to analyze differences between the two JSON objects
2. **Unified Diff Generation**: Creates a unified diff using `unidiff` for visual comparison
3. **Interactive UI**: Renders the diff with `react-diff-view` and adds interactive controls
4. **Real-time Updates**: Tracks user selections and updates the merged result in real-time

## Development

### Building the Library

```bash
npm run build
```

### Running the Demo

```bash
cd demo
npm install
npm run dev
```

### Linting and Formatting

```bash
npm run check      # Run linter with auto-fix
npm run format     # Format code
```

## License

Apache-2.0

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Credits

Built with:
- [react-diff-view](https://github.com/otakustay/react-diff-view) - Diff rendering
- [deep-diff](https://github.com/flitbit/diff) - Object comparison
- [unidiff](https://github.com/sergeyt/unidiff) - Unified diff generation
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [Radix UI](https://www.radix-ui.com/) - Accessible components
