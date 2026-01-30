---
name: local-deploy
description: Copy plugin files to the local Obsidian vault
disable-model-invocation: true
allowed-tools: Bash
---

# Deploy to Obsidian Vault

Copy all required plugin files to the local Obsidian vault at `D:/GitHub/ran-work/.obsidian/plugins/integrated-terminal/`.

Run these steps in order. **Stop immediately if any step fails.**

1. **Create the plugin directory if needed**:
   ```bash
   mkdir -p "D:/GitHub/ran-work/.obsidian/plugins/integrated-terminal/node_modules"
   ```

2. **Copy plugin files** (main.js, manifest.json, styles.css, pty-host.js):
   ```bash
   cp D:/GitHub/obsidian-vs-code-terminal/main.js D:/GitHub/obsidian-vs-code-terminal/manifest.json D:/GitHub/obsidian-vs-code-terminal/styles.css D:/GitHub/obsidian-vs-code-terminal/pty-host.js "D:/GitHub/ran-work/.obsidian/plugins/integrated-terminal/"
   ```

3. **Remove existing node-pty and copy fresh** (Obsidian locks native binaries while running):
   ```bash
   rm -rf "D:/GitHub/ran-work/.obsidian/plugins/integrated-terminal/node_modules/node-pty" && cp -r D:/GitHub/obsidian-vs-code-terminal/node_modules/node-pty "D:/GitHub/ran-work/.obsidian/plugins/integrated-terminal/node_modules/"
   ```

4. **Verify deployment** -- confirm all files landed correctly:
   ```bash
   ls -la "D:/GitHub/ran-work/.obsidian/plugins/integrated-terminal/" && echo "---" && ls "D:/GitHub/ran-work/.obsidian/plugins/integrated-terminal/node_modules/node-pty/prebuilds/win32-x64/" 2>&1
   ```

After deploying, tell the user to reload Obsidian (Ctrl+P → "Reload app without saving") to pick up changes.
