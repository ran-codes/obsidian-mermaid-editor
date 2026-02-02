# Mermaid Live Editor

A split-pane Mermaid diagram editor for [Obsidian](https://obsidian.md) with live preview, pan/zoom, and bidirectional sync to markdown notes.

Type Mermaid code on the left, see the rendered diagram on the right. Load from or save back to fenced `mermaid` blocks in your notes.

## Features

- **Live preview** — diagrams re-render as you type
- **Pan and zoom** — scroll to zoom, drag to pan the rendered SVG
- **Resizable split pane** — drag the divider to adjust the code/preview ratio
- **Load from note** — pull a `mermaid` code block from the active note into the editor
- **Save to note** — write the diagram back to the originating note (or the active editor)
- **Multiple instances** — open several editors side by side, each with its own buffer
- **Buffer persistence** — editor content is saved to disk and restored across sessions
- **External editing** — edit the buffer file with external tools; the editor watches for changes
- **Configurable Mermaid theme** — choose from default, dark, forest, or neutral

## Usage

1. Open the editor from the ribbon icon or the command palette: **Open Mermaid Editor**
2. Type or paste Mermaid syntax in the left pane
3. The diagram renders live in the right pane

### Loading from a note

- Open a markdown note containing a fenced `mermaid` block
- Run **Open Mermaid diagram from note** from the command palette
- The first `mermaid` block is loaded into a new editor tab

### Saving to a note

- Click the **Save to note** action in the view header
- If the diagram was loaded from a note, it writes back to the same block
- Otherwise it replaces/inserts into the active markdown editor

## Settings

| Setting | Description | Default |
|---------|-------------|---------|
| Mermaid theme | Rendering theme (default, dark, forest, neutral) | `default` |
| Debounce delay | Milliseconds to wait after typing before re-rendering | `300` |

## Installation

### From Community Plugins

1. Open **Settings > Community Plugins**
2. Search for **Mermaid Live Editor**
3. Click **Install**, then **Enable**

### Manual

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/ran-codes/obsidian-mermaid-editor/releases/latest)
2. Create a folder: `<vault>/.obsidian/plugins/mermaid-live-editor/`
3. Copy the three files into that folder
4. Reload Obsidian and enable the plugin in **Settings > Community Plugins**

## License

[MIT](LICENSE)
