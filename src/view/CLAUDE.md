# src/view/ — View Module Architecture

## Pattern

**Orchestrator pattern** — `mermaid-view.ts` is a thin orchestrator that owns DOM refs and state, delegates all logic to focused modules.

## Module responsibilities

| Module | Owns | Exports |
|--------|------|---------|
| `mermaid-view.ts` | DOM refs, state, toolbar, lifecycle | `MermaidView`, `VIEW_TYPE_MERMAID` |
| `buffer.ts` | Buffer file I/O | `readBuffer()`, `writeBuffer()` |
| `note-io.ts` | Mermaid block regex, note load/save | `loadMermaidFromNote()`, `saveMermaidToNote()` |
| `renderer.ts` | Render counter, mermaid init | `initMermaid()`, `renderMermaid()` |
| `pan-zoom.ts` | svg-pan-zoom config | `createPanZoom()`, `destroyPanZoom()`, `resetPanZoom()` |
| `resize-handle.ts` | Drag math, mouse listeners | `setupResizeHandle()` |

## DOM structure

```
contentEl (mermaid-editor-container)
├── toolbar (mermaid-toolbar)
│   ├── button "Load from note"
│   ├── button "Save to note"
│   ├── button "Reload buffer"
│   ├── button "Reset zoom"
│   └── span.mermaid-origin-label
└── splitPane (mermaid-split-pane)
    ├── codePane (mermaid-code-pane)
    │   └── textarea (mermaid-code-editor)
    ├── resizeHandle (mermaid-resize-handle)
    └── previewPane (mermaid-preview-pane)
        ├── previewContent (mermaid-preview-content)
        └── errorDisplay (mermaid-error-display)
```

## State management

- **Buffer origin** (`BufferOrigin | null`) — persisted in plugin settings (`settings.bufferOrigin`), tracks which note/block the buffer was loaded from
- **Buffer content** — persisted to `buffer.mmd` on disk via `DataAdapter`
- **Pan/zoom instance** — transient, recreated on each render, destroyed on close

## Lifecycle

### `onOpen()`
1. Build DOM (toolbar, split pane, textarea, preview)
2. Wire resize handle via `setupResizeHandle()`
3. Restore origin from `plugin.settings.bufferOrigin`
4. Restore content from `buffer.mmd` (or use default diagram)
5. `initMermaid()` + `renderMermaid()`

### `onClose()`
1. Flush textarea to `buffer.mmd` via `writeBuffer()`
2. Clear debounce timer
3. `destroyPanZoom()`
4. Null out DOM refs
