# src/ — Module Map

| File | Purpose |
|------|---------|
| `main.ts` | Plugin entry — registers view type, ribbon icon, command palette, settings tab |
| `settings.ts` | `MermaidEditorSettings` and `BufferOrigin` interfaces, `DEFAULT_SETTINGS`, settings UI tab |
| `view/` | View module — see `view/CLAUDE.md` for details |

## Data flow

```
User types in textarea
  → debounce (settings.debounceMs)
  → renderMermaid() updates SVG preview
  → writeBuffer() persists to buffer.mmd

"Load from note" click
  → loadMermaidFromNote() reads active note's first ```mermaid block
  → sets textarea value + origin tracking
  → triggers debounced render

"Save to note" click
  → saveMermaidToNote() writes back to origin file/block (or active editor fallback)
  → updates origin tracking

"Reload buffer" click
  → readBuffer() reads buffer.mmd from disk
  → sets textarea value
  → triggers debounced render
```

## External tool workflow

The buffer file at `.obsidian/plugins/mermaid-live-editor/buffer.mmd` can be edited by external tools (CLI, scripts). The user clicks "Reload buffer" to pull changes into the editor.

## Import conventions

- `import type` for cross-module type references (e.g., `BufferOrigin`, `MermaidEditorPlugin`)
- View modules import from siblings (`./buffer`, `./pan-zoom`, etc.)
- View modules import settings types from `../settings`
