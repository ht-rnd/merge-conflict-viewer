import {
  type JSX,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react"

interface ResultEditorProps {
  /** Heading of the editor. */
  title: string
  /** Accessible name of the text field. */
  inputLabel: string
  applyLabel: string
  cancelLabel: string
  initialText: string
  onCommit: (value: unknown) => void
  onCancel: () => void
}

/** Inline JSON editor for the value of one change in the result. */
export function ResultEditor({
  title,
  inputLabel,
  applyLabel,
  cancelLabel,
  initialText,
  onCommit,
  onCancel,
}: ResultEditorProps): JSX.Element {
  const [text, setText] = useState(initialText)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const submit = (): void => {
    let value: unknown
    try {
      value = JSON.parse(text)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Invalid JSON")
      return
    }
    onCommit(value)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === "Escape") {
      event.preventDefault()
      onCancel()
    } else if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      submit()
    }
  }

  const rows = Math.min(Math.max(text.split("\n").length, 3), 14)

  return (
    <div className="mcv-editor">
      <span className="mcv-editor-title">{title}</span>
      <textarea
        ref={inputRef}
        className="mcv-editor-input"
        value={text}
        rows={rows}
        spellCheck={false}
        aria-label={inputLabel}
        aria-invalid={error !== null}
        onChange={(event) => {
          setText(event.target.value)
          setError(null)
        }}
        onKeyDown={onKeyDown}
      />
      {error && (
        <span className="mcv-editor-error" role="alert">
          {error}
        </span>
      )}
      <div className="mcv-editor-actions">
        <button
          type="button"
          className="mcv-button mcv-button-small"
          onClick={onCancel}
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          className="mcv-button mcv-button-small mcv-button-primary"
          onClick={submit}
        >
          {applyLabel}
        </button>
      </div>
    </div>
  )
}
