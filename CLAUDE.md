# Obsidian Mermaid Editor

A split-pane Mermaid diagram editor for Obsidian with live preview, pan/zoom, and bidirectional sync to markdown notes. Users type Mermaid code on the left, see a rendered SVG on the right, and can load from or save back to fenced `mermaid` blocks in their notes.

## Tech stack

- **Obsidian API** — plugin lifecycle, vault I/O, workspace views
- **mermaid** — diagram parsing and SVG rendering
- **svg-pan-zoom** — pan/zoom on rendered SVGs
- **esbuild** — bundling (config in `esbuild.config.mjs`)
- **TypeScript** — strict null checks enabled

## Build

```sh
npm run build     # type-check + bundle to main.js
npm run dev       # watch mode (esbuild only, no type-check)
```

## Deploy to vault

Copy `main.js`, `manifest.json`, and `styles.css` to:
```
<vault>/.obsidian/plugins/mermaid-live-editor/
```

## Architecture

```
src/main.ts          → Plugin entry: registers view, ribbon icon, command, settings tab
src/settings.ts      → Settings types (MermaidEditorSettings, BufferOrigin) + settings UI
src/view/            → View module (see src/view/CLAUDE.md)
  mermaid-view.ts    → Thin orchestrator — lifecycle, toolbar, wiring
  buffer.ts          → Buffer file read/write
  note-io.ts         → Load/save mermaid blocks to/from notes
  renderer.ts        → Mermaid init + SVG rendering pipeline
  pan-zoom.ts        → svg-pan-zoom lifecycle wrapper
  resize-handle.ts   → Draggable split-pane resize handle
styles.css           → All CSS (uses Obsidian CSS variables)
```

## Key conventions

- Use Obsidian CSS variables (`var(--background-primary)`, etc.) for all styling
- Use `DataAdapter` (via `app.vault.adapter`) for raw file I/O (buffer file)
- Use `normalizePath()` for all vault-relative paths
- Type-only imports (`import type`) for cross-module type references
