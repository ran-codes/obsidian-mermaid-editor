---
name: local-deploy
description: Copy plugin files to the local Obsidian vault
disable-model-invocation: true
allowed-tools: Bash
---

# Deploy to Obsidian Vault

Copy all required plugin files to the local Obsidian vault at `D:/GitHub/ran-work/.obsidian/plugins/mermaid-live-editor/`.

Run these steps in order. **Stop immediately if any step fails.**

1. **Create the plugin directory if needed**:
   ```bash
   mkdir -p "D:/GitHub/ran-work/.obsidian/plugins/mermaid-live-editor"
   ```

2. **Copy plugin files** (main.js, manifest.json, styles.css):
   ```bash
   cp D:/GitHub/obsidian-mermaid-editor/main.js D:/GitHub/obsidian-mermaid-editor/manifest.json D:/GitHub/obsidian-mermaid-editor/styles.css "D:/GitHub/ran-work/.obsidian/plugins/mermaid-live-editor/"
   ```

3. **Verify deployment** -- confirm all files landed correctly:
   ```bash
   ls -la "D:/GitHub/ran-work/.obsidian/plugins/mermaid-live-editor/"
   ```

After deploying, tell the user to reload Obsidian (Ctrl+P → "Reload app without saving") to pick up changes.
