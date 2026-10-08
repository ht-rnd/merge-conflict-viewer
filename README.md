# merge-conflict-viewer

Let users resolve the differences between two JSON documents in a React app, and tell you when the result is safe to save.

![Merge Conflict Viewer: Current, Result and Incoming panes with an unresolved-changes banner](docs/viewer-in-progress.png)

You give it a **current** and an **incoming** document. It shows them side by side with a live **result** in the middle (the layout you know from IntelliJ's merge tool). For every difference the user accepts the current value, accepts the incoming value, removes it, or types their own. You get the merged document, and a status that says whether every difference has been decided.

- Compares **by structure, not by line**: keys and array items are matched, so a key that only exists on one side gets blank space opposite it instead of being lined up with an unrelated key.
- **"All changes resolved"** is a first-class state: a banner, a `status` object and a `Next unresolved` button.
- **Editable result** (opt in), **undo and redo**, **folded unchanged lines**, previous/next change navigation, stacked layout on narrow screens, light and dark.
- **Self-contained**: React is the only peer dependency. No Tailwind, no CSS to import, about 10 kB gzipped.
- **Headless too**: the merge logic is available as a hook and as plain functions (browser, server, CLI).

## Is this the right tool?

Use it when you have two versions of a JSON document (a saved config and an incoming change, two drafts, local and remote) and a person has to decide what the final document looks like.

It is a **two-way** comparison. There is no common ancestor ("base"), so it never merges anything automatically and does not tell "changed on one side" apart from "changed on both". Every difference is presented for a decision, and the default is the incoming value. The root of each document must be a JSON object.

## Install

```bash
npm install @ht-rnd/merge-conflict-viewer
```

Requires React 18 or newer.

## Quick start

```tsx
import { useRef, useState } from "react"
import {
  MergeConflictViewer,
  type MergeConflictViewerHandle,
  type MergeStatus,
} from "@ht-rnd/merge-conflict-viewer"

export function ResolveConfig({ current, incoming, onSave }) {
  const viewer = useRef<MergeConflictViewerHandle>(null)
  const [status, setStatus] = useState<MergeStatus>()

  return (
    <>
      <MergeConflictViewer
        ref={viewer}
        currentJson={current}
        incomingJson={incoming}
        onMergeChange={(_merged, nextStatus) => setStatus(nextStatus)}
        height={600}
      />

      <button
        disabled={!status?.allResolved}
        onClick={() => onSave(viewer.current!.getResult())}
      >
        Save
      </button>
    </>
  )
}
```

That is the whole integration. Nothing else needs to be imported or configured; the styles add themselves.

## How it works from the user's side

Every difference is a **change**: a value that differs, a key or array item that exists on one side only, or a type change. Each change is resolved on its own:

| Control | Effect |
|---|---|
| `»` next to Current | Use the current value |
| `«` next to Incoming | Use the incoming value |
| `×` | Remove the key or item from the result |
| pencil in Result (with `editable`) | Write a JSON value yourself |
| `Apply all from current / incoming` | Resolve every change from one side |
| Undo / Redo (`Ctrl/Cmd+Z`, `Ctrl+Shift+Z`) | Step back and forward through decisions, up to 100 steps |

A change starts **unresolved**: the Result pane shows the incoming value on an amber background, and neither side is highlighted as accepted. (An unresolved change that only exists in current is absent from the result, because incoming does not have it.) Once the user decides, the change turns into a normal blue (modified) or green (one side only) block, the side that was not chosen fades, and the banner (with a progress bar) counts down. When nothing is left:

![Banner reading "All 11 changes resolved. Safe to merge." and an edited value shown in violet](docs/viewer-resolved.png)

## Recipes

### Only allow saving when everything is decided

`onMergeChange` receives the merged document and a status. `allResolved` is also `true` when the two documents have no differences.

```tsx
onMergeChange={(merged, status) => {
  setDraft(merged)
  setCanSave(status.allResolved)
}}
```

```ts
interface MergeStatus {
  total: number        // changes between the two documents
  resolved: number     // changes someone has decided (side, removal or edit)
  unresolved: number
  edited: number       // resolved changes whose value was typed by hand
  allResolved: boolean // nothing left to decide: safe to merge
}
```

`onMergeChange` runs once on mount (with the starting result), then whenever the result or the status changes. In React strict mode development builds the mount call happens twice, so keep the handler idempotent.

### Read the result when you need it

Use a ref instead of mirroring everything into state:

```tsx
const viewer = useRef<MergeConflictViewerHandle>(null)

viewer.current?.getResult()   // the merged JsonObject (treat it as read-only, clone it if you need to change it)
viewer.current?.getStatus()
viewer.current?.applyAll("left" | "right")
viewer.current?.reset()          // back to the starting state (can be undone)
viewer.current?.undo()
viewer.current?.redo()
viewer.current?.goToNextUnresolved() // scrolls there, returns false when none is left
viewer.current?.goToChange("next" | "previous")
```

### Fit it into a dialog or a flex layout

`height` is the height of the whole viewer, toolbar and banner included. The panes take the rest and scroll internally, and the column headers stay in view.

```tsx
<div style={{ height: "80vh" }}>
  <MergeConflictViewer height="100%" currentJson={a} incomingJson={b} />
</div>
```

`height="100%"` needs a parent with a definite height. `maxHeight` caps the viewer but lets it be shorter for small documents. With neither, the viewer grows with its content (and the headers are not sticky, because nothing scrolls inside it).

### Save a half-finished merge and resume it

Own the state with `decisions` and `onDecisionsChange`. `decisions` only contains the changes that have been decided: each value is `"left"`, `"right"`, `"deleted"` or `{ custom: value }`. Changes without an entry are unresolved.

```tsx
import type { Selection } from "@ht-rnd/merge-conflict-viewer"

const [decisions, setDecisions] = useState<Selection>(() => loadDraft() ?? {})

<MergeConflictViewer
  currentJson={current}
  incomingJson={incoming}
  decisions={decisions}
  onDecisionsChange={(next) => {
    setDecisions(next)
    saveDraft(next)
  }}
/>
```

Change ids are the JSON path of the change (for example `["address","city"]` or `["steps",2]`), so a saved draft stays valid as long as the two documents stay the same. If either document changes, the viewer starts over (see below).

If you only have a previous *result* rather than decisions, pass it as `initialMergedJson`. Each change starts on the side it matches, a value that matches neither becomes an edited value, and the changes count as already resolved (override with `startUnresolved`).

### Let users edit values

```tsx
<MergeConflictViewer editable currentJson={a} incomingJson={b} />
```

Each change in the Result pane gets a pencil. It opens a small JSON editor for that change's value: `Ctrl/Cmd + Enter` applies, `Esc` cancels, and invalid JSON is rejected with the parser's message. Edited values are shown in violet, count as resolved and as `edited` in the status, and have an undo button. Editing is per change, which keeps the three panes aligned and each one valid JSON. It is off by default.

### Large documents

Every line is rendered (there is no virtualization), so for big documents fold the parts that did not change:

```tsx
<MergeConflictViewer collapseUnchanged={3} ... />   // true = 3 lines of context
```

Long unchanged runs collapse into a `⋯ 120 unchanged lines` row that expands on click. Users can toggle it from the toolbar.

### Translate or reword the UI

Every text goes through one `labels` prop. Set what you need; the rest keeps its English default. Functions receive what they need to build the sentence.

```tsx
<MergeConflictViewer
  labels={{
    current: "Aktuell",
    result: "Ergebnis",
    incoming: "Eingehend",
    applyAllCurrent: "Alle aktuellen übernehmen",
    unresolved: ({ unresolved }) => `${unresolved} Änderungen offen`,
    allResolved: () => "Alles entschieden. Zusammenführen ist sicher.",
    acceptCurrent: (change) => `Aktuell übernehmen: ${change}`,
  }}
  ...
/>
```

See [`labels`](#labels) for the full list.

### Start over when the inputs change

The viewer resets its decisions whenever the *content* of `currentJson` or `incomingJson` changes (they are compared by value, so passing a new object with the same content does nothing). It does not reset when `initialMergedJson`, `startUnresolved` or the controlled `decisions` change. To force a fresh start, give it a `key`:

```tsx
<MergeConflictViewer key={documentId} ... />
```

### Build your own UI, or run it without UI

Everything the component does is available without it:

```tsx
import { useMergeConflicts } from "@ht-rnd/merge-conflict-viewer"

const { tree, merged, status, choose, applyAll, revert, reset, isResolved } =
  useMergeConflicts({ currentJson, incomingJson })

tree.conflicts.map((change) => (
  <li key={change.id}>
    {change.label} ({change.kind})
    <button onClick={() => choose(change.id, "left")}>Mine</button>
    <button onClick={() => choose(change.id, "right")}>Theirs</button>
    <button onClick={() => choose(change.id, { custom: 42 })}>42</button>
  </li>
))
```

The functions work anywhere, including Node:

```ts
import {
  buildMergeTree,
  buildMergedJson,
  getMergeStatus,
  selectAll,
} from "@ht-rnd/merge-conflict-viewer"

const tree = buildMergeTree(current, incoming)
const decisions = selectAll(tree, "right")

buildMergedJson(tree, decisions) // equals `incoming`
getMergeStatus(tree, decisions)  // { total, resolved, unresolved, edited, allResolved }
```

To keep the viewer's toolbar position but replace its content, use `renderToolbar={(state) => ...}`; it receives the same object the hook returns.

## API

### `<MergeConflictViewer>`

| Prop | Type | Default | Description |
|---|---|---|---|
| `currentJson` | `JsonObject` | required | The left document |
| `incomingJson` | `JsonObject` | required | The right document |
| `onMergeChange` | `(merged: JsonObject, status: MergeStatus) => void` | | Called on mount and when the result or status changes |
| `initialMergedJson` | `JsonObject` | | An existing result; each change starts on the side it matches |
| `startUnresolved` | `boolean` | `true` unless `initialMergedJson` is given | Whether changes start undecided |
| `decisions` | `Selection` | | Controlled decisions (see above) |
| `onDecisionsChange` | `(decisions: Selection) => void` | | Called with the full decisions after every change |
| `editable` | `boolean` | `false` | Let users type values in the Result pane |
| `height` | `number \| string` | | Height of the whole viewer; `"100%"` fills the parent |
| `maxHeight` | `number \| string` | | Upper bound for the height |
| `layout` | `"horizontal" \| "vertical" \| "responsive"` | `"responsive"` | Side by side, stacked, or stacked below 900 px of width |
| `collapseUnchanged` | `boolean \| number` | `false` | Fold unchanged runs; a number sets the context lines (default 3) |
| `labels` | `MergeConflictViewerLabels` | English | Every text in the UI, see [Labels](#labels) |
| `hideToolbar` | `boolean` | `false` | Hide the toolbar (bulk actions, navigation, fold toggle) |
| `hideStatus` | `boolean` | `false` | Hide the banner |
| `renderToolbar` | `(state: MergeConflictsState) => ReactNode` | | Replace the toolbar |
| `className`, `style` | | | Applied to the root element |

`layout="vertical"` stacks the panes as Current, Incoming, Result.

### Labels

All keys are optional.

| Key | Default |
|---|---|
| `current`, `result`, `incoming` | `Current`, `Result`, `Incoming` |
| `applyAllCurrent`, `applyAllIncoming` | `Apply all from current`, `Apply all from incoming` |
| `previousChange`, `nextChange`, `undo`, `redo` | `Previous change`, `Next change`, `Undo`, `Redo` |
| `hideUnchanged` | `Hide unchanged lines` |
| `summary(status)` | `11 changes` / `No differences` |
| `noChanges` | `No differences. Nothing to merge.` |
| `unresolved(status)` | `3 of 11 changes still need a decision.` |
| `allResolved(status)` | `All 11 changes resolved. Safe to merge.` |
| `nextUnresolved` | `Next unresolved` |
| `unchangedLines(count)`, `showUnchanged(count)` | `120 unchanged lines`, `Show 120 unchanged lines` |
| `acceptCurrent(change)`, `acceptIncoming(change)` | `Accept current address.city`, `Accept incoming address.city` |
| `removeChange(change)`, `editChange(change)`, `revertEdit(change)` | `Remove address.city from result`, ... |
| `editorTitle(change)`, `editorInput(change)`, `apply`, `cancel` | the value editor |

### `useMergeConflicts(options)`

Options: `currentJson`, `incomingJson`, `initialMergedJson`, `startUnresolved`, `decisions`, `onDecisionsChange` (same meaning as above).

| Returns | Description |
|---|---|
| `tree` | The comparison. `tree.conflicts` is the ordered list of changes: `{ id, label, kind, path, hasLeft, hasRight, left, right }` where `kind` is `"modified"`, `"left-only"` or `"right-only"` and `label` reads like `endpoints[0].scopes[1]` |
| `merged` | The merged document |
| `status` | `MergeStatus` |
| `decisions` | Explicit decisions only (what to persist) |
| `selection` | What the result holds per change, including the defaults of undecided changes |
| `isResolved(id)` | Whether a change has been decided |
| `choose(id, choice)` | `choice` is `"left"`, `"right"`, `"deleted"` or `{ custom: value }` |
| `revert(id)` | Undo one decision, back to how it started |
| `applyAll(side)` | Resolve every change from `"left"` or `"right"` |
| `reset()` | Back to the starting state (can be undone) |
| `undo()`, `redo()` | Step through your decisions (up to 100); no-op decisions are not recorded |
| `canUndo`, `canRedo` | Whether there is something to undo or redo |

Choosing a side that does not have the key (for example `"left"` for a key that only incoming has) removes it from the result.

### Functions and types

```ts
// Functions
buildMergeTree(current, incoming)      // MergeTree
buildMergedJson(tree, selection)       // JsonObject
getMergeStatus(tree, decisions)        // MergeStatus
selectAll(tree, "left" | "right")      // Selection with every change set to one side
initialSelection(tree, initialMerged?) // how changes start for a given initial result
buildMergeLayout(tree, selection)      // aligned rows for the three panes
foldRows(rows, context, expanded)      // folds unchanged runs of those rows
deepEqual(a, b)
isCustomChoice(choice)

// Types
JsonObject, DiffSide, SideSelection, Choice, CustomChoice, Selection, MergeStatus,
MergeTree, ConflictEntry, ConflictKind, MergeLayout, MergeRow, MergeBlock,
ResolvedChoice, DisplayItem, MergeConflictViewerProps, MergeConflictViewerHandle,
MergeConflictViewerLabels, MergeConflictsState, UseMergeConflictsOptions
```

## Styling

The component injects one `<style id="mcv-styles">` the first time it renders, at the start of `<head>` so your own CSS can override it.

**Theme.** It reads the standard shadcn/ui tokens (`--background`, `--foreground`, `--border`, `--muted-foreground`, `--ring`) when your app defines them, and has its own defaults when it does not. For dark mode add the `dark` class to the viewer (`className="dark"`) or to any ancestor.

**Re-theme** by overriding variables on `.mcv-root`:

```css
.mcv-root {
  --mcv-accent: #7c3aed;
  --mcv-modified-bg: #e8e4fb;
}
```

| Variable | What it colors |
|---|---|
| `--mcv-bg`, `--mcv-fg`, `--mcv-muted`, `--mcv-border`, `--mcv-ring` | Surface, text, line numbers, borders, focus ring |
| `--mcv-modified-bg`, `-edge`, `-edit` | A value that differs (block, its border, the changed characters) |
| `--mcv-added-bg`, `-edge`, `-edit` | A key or item that exists on one side only |
| `--mcv-pending-bg`, `-edge`, `-edit` | A result that has not been decided |
| `--mcv-edited-bg`, `-edge`, `-edit` | A result typed by hand |
| `--mcv-filler-bg`, `--mcv-filler-line` | The hatched space opposite a missing key |
| `--mcv-success-*`, `--mcv-warning-icon` | The banner |
| `--mcv-accent`, `--mcv-danger` | Accepted side, removal |

**Server rendering or a strict Content Security Policy.** Runtime style injection only happens in the browser. If you render on the server, or your CSP forbids inline `<style>`, import the same stylesheet yourself:

```ts
import "@ht-rnd/merge-conflict-viewer/styles"
```

## How documents are compared

1. **Objects** are compared key by key, recursively. Keys are listed in the incoming document's order; keys that only exist in current are placed after their closest preceding neighbour.
2. **Arrays** keep each pane's own order. Items are matched with a longest-common-subsequence alignment:
   - by an identity field when every item of both arrays is an object with a unique `id`, `@id`, `key`, `name`, `code`, `uuid` or `slug` (first one that qualifies), so an edited object shows its changed fields instead of "removed + added";
   - otherwise by exact equality (key order inside objects does not matter);
   - items left between two matches are paired by position and compared recursively, and any remainder is a removal or an addition.
3. **Type changes** (string to number, array to object, `null` to a value) are one change.
4. **A moved array item** shows as removed in one place and added in the other.
5. Each change is a block as tall as its longer side, padded with hatched filler, so the panes always line up row for row. Commas are computed per pane, so each pane is valid JSON.

The input documents are never modified.

## Testing your integration

The root element carries `data-mcv-status="pending" | "resolved" | "empty"`, and every button has an accessible name (see [Labels](#labels)), so tests can use `getByLabelText("Accept current address.city")` and `getByRole("status")`. The viewer renders in jsdom; it only needs `ResizeObserver` to be absent or stubbed (it is skipped when missing).

## Good to know

- **Accessibility.** All controls are real buttons with labels such as `Accept incoming address.city`, the banner is an `<output>` live region, and the editor works from the keyboard. Line-number gutters are hidden from assistive technology.
- **Browsers.** Evergreen browsers from 2023 on (it uses CSS `color-mix()` and `Object.hasOwn`).
- **Size.** About 10 kB gzipped (ESM) including the styles, plus `lucide-react` and `clsx` as regular dependencies.
- **Not included.** Three-way merge with a base, automatic merging, merging non-object roots, and virtualized rendering.

## Development

```bash
npm install
npm run test          # unit and component tests (vitest)
npm run check         # lint and format with Biome, writing fixes
npm run build         # lint, then build the package into dist/
npm run test:package  # build, pack, and use the packed tarball as a consumer would
```

The demo app lives in `demo/` (Vite with shadcn/ui). It is a showcase and is not published:

```bash
cd demo
npm install
npm run dev
```

## License

Apache-2.0
