# Mermaid Live Editor - Product Requirements Document (v0.0.1)

## Problem

Obsidian users who write Mermaid diagrams must switch between editing and reading mode to see their rendered diagrams. There is no existing plugin that provides a split-pane live editing experience with pan/zoom for Mermaid diagrams.

## Solution

A plugin that opens a dedicated editor tab with:
- A code textarea on the left for writing Mermaid syntax
- A live-rendered SVG preview on the right
- Pan and zoom controls for navigating complex diagrams
- Bidirectional integration with notes (load from / save to active note)

## Target Users

Obsidian users who create Mermaid diagrams in their notes and want a faster editing feedback loop.

## Features (v0.0.1)

### Split-Pane Editor
- Left pane: monospace textarea with Mermaid code
- Right pane: rendered SVG preview
- Draggable resize handle between panes (15%-85% range)
- Default 50/50 split

### Live Preview
- Debounced rendering on every keystroke (configurable delay, default 300ms)
- Error messages displayed below preview when syntax is invalid
- Starter diagram pre-populated on open

### Pan & Zoom
- Mouse wheel zoom on preview pane
- Click-and-drag panning
- Double-click to reset view
- "Reset zoom" toolbar button
- Powered by svg-pan-zoom library

### Note Integration
- "Load from note" button: extracts first ```mermaid``` code block from active note
- "Save to note" button: replaces existing mermaid block or appends new one
- Uses Obsidian's editor API for undo integration

### Settings
- Debounce delay (slider, 0-1000ms)
- Mermaid theme (dropdown: default/dark/forest/neutral)

### Access
- Ribbon icon (git-compare)
- Command palette: "Mermaid Live: Open editor"
- Singleton pattern: reuses existing tab if already open

## Non-Goals (v0.0.1)
- Syntax highlighting in the editor textarea
- Multiple diagram tabs
- Export to PNG/PDF
- Custom Mermaid configuration beyond theme
- Mobile-specific UI optimizations
