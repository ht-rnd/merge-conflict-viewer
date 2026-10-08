import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { examples } from "../data/examples"

interface ViewerConfigProps {
  selectedExample: string
  onExampleChange: (key: string) => void
  layout: "horizontal" | "vertical" | "responsive"
  onLayoutChange: (layout: "horizontal" | "vertical" | "responsive") => void
  height: string
  onHeightChange: (height: string) => void
  initialMerged: InitialResult
  onInitialMergedChange: (value: InitialResult) => void
  editable: boolean
  onEditableChange: (value: boolean) => void
  collapseUnchanged: boolean
  onCollapseUnchangedChange: (value: boolean) => void
}

export type InitialResult = "none" | "current" | "incoming"

function Toggle({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string
  label: string
  hint: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
      </Label>
      <label className="flex items-center gap-2 text-sm" htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
        {hint}
      </label>
    </div>
  )
}

export function ViewerConfig({
  selectedExample,
  onExampleChange,
  layout,
  onLayoutChange,
  height,
  onHeightChange,
  initialMerged,
  onInitialMergedChange,
  editable,
  onEditableChange,
  collapseUnchanged,
  onCollapseUnchangedChange,
}: ViewerConfigProps) {
  return (
    <div>
      <p className="text-2xl font-medium mb-6">Viewer Configuration</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="flex flex-col gap-2">
          <Label htmlFor="layout-select" className="text-sm font-medium">
            Layout
          </Label>
          <Select value={layout} onValueChange={onLayoutChange}>
            <SelectTrigger id="layout-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="responsive">Responsive</SelectItem>
              <SelectItem value="horizontal">Horizontal</SelectItem>
              <SelectItem value="vertical">Vertical</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="height-input" className="text-sm font-medium">
            Height
          </Label>
          <Input
            id="height-input"
            type="text"
            value={height}
            onChange={(e) => onHeightChange(e.target.value)}
            placeholder="e.g., 600px or 80vh"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="initial-result" className="text-sm font-medium">
            Initial Result
          </Label>
          <Select value={initialMerged} onValueChange={onInitialMergedChange}>
            <SelectTrigger id="initial-result">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None: review every change</SelectItem>
              <SelectItem value="incoming">
                Incoming (counts as decided)
              </SelectItem>
              <SelectItem value="current">
                Current (counts as decided)
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Toggle
          id="editable"
          label="Editable result"
          hint="Edit values by hand in the Result pane"
          checked={editable}
          onChange={onEditableChange}
        />

        <Toggle
          id="collapse-unchanged"
          label="Unchanged lines"
          hint="Start with long unchanged runs folded"
          checked={collapseUnchanged}
          onChange={onCollapseUnchangedChange}
        />

        <div className="flex flex-col gap-2">
          <Label htmlFor="example-select" className="text-sm font-medium">
            Example
          </Label>
          <Select value={selectedExample} onValueChange={onExampleChange}>
            <SelectTrigger id="example-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(examples).map(([key, example]) => (
                <SelectItem key={key} value={key}>
                  {example.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            {examples[selectedExample]?.description}
          </p>
        </div>
      </div>
    </div>
  )
}
