# Mermaid Live Editor - Implementation Plan

## Overview

Scaffold and implement an Obsidian plugin (`mermaid-live-editor`) that provides a split-pane Mermaid diagram editor with live preview and pan/zoom. Mirrors the scaffolding conventions from `obsidian-integrated-terminal`.

## File Structure

```
obsidian-mermaid-editor/
├── src/
│   ├── main.ts                 # Plugin entry point
│   ├── mermaid-view.ts         # Split-pane ItemView (core logic)
│   └── settings.ts             # Settings interface + tab
├── manifest.json               # Plugin metadata
├── package.json                # Dependencies & scripts
├── tsconfig.json               # TypeScript config
├── esbuild.config.mjs          # Build config (bundles mermaid + svg-pan-zoom)
├── styles.css                  # All plugin CSS
├── versions.json               # Version compatibility map
├── version-bump.mjs            # Version bump script
├── .gitignore
├── .npmrc
├── .editorconfig
├── .gitattributes              # (already exists)
└── LICENSE
```

## Step 1: Config/scaffold files

Create all config files matching `obsidian-integrated-terminal` patterns.

## Step 2: `npm install`

Install all dependencies after config files are in place.

## Step 3: `src/settings.ts`

Minimal settings for v0.1:
- `debounceMs: number` (default 300)
- `mermaidTheme: string` (default "default")
- Standard `PluginSettingTab` subclass

## Step 4: `src/mermaid-view.ts` (core file)

Custom `ItemView` with split-pane editor, live rendering, pan/zoom, resizable divider, load/save from note.

## Step 5: `src/main.ts`

Standard plugin entry with view registration, ribbon icon, command, settings tab, singleton pattern.

## Step 6: `styles.css`

All styles using Obsidian CSS variables for theme compatibility.

## Step 7: Build and verify

Run `npm run build` to produce `main.js` without errors.
