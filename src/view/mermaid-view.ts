import { ItemView, Notice, WorkspaceLeaf } from "obsidian";
import type MermaidEditorPlugin from "../main";
import type { BufferOrigin } from "../settings";
import { readBuffer, writeBuffer } from "./buffer";
import { loadMermaidFromNote, saveMermaidToNote } from "./note-io";
import { initMermaid, renderMermaid } from "./renderer";
import { destroyPanZoom, resetPanZoom, type PanZoomInstance } from "./pan-zoom";
import { setupResizeHandle } from "./resize-handle";

export const VIEW_TYPE_MERMAID = "mermaid-live-view";

const DEFAULT_DIAGRAM = `graph TD
    A[Start] --> B{Is it working?}
    B -->|Yes| C[Great!]
    B -->|No| D[Debug]
    D --> B`;

export class MermaidView extends ItemView {
	plugin: MermaidEditorPlugin;

	private textarea: HTMLTextAreaElement | null = null;
	private previewContent: HTMLElement | null = null;
	private errorDisplay: HTMLElement | null = null;

	private panZoomInstance: PanZoomInstance | null = null;
	private debounceTimer: ReturnType<typeof setTimeout> | null = null;

	private sourceOrigin: BufferOrigin | null = null;
	private originLabel: HTMLElement | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: MermaidEditorPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_MERMAID;
	}

	getDisplayText(): string {
		return "Mermaid Live Editor";
	}

	getIcon(): string {
		return "fish";
	}

	async onOpen(): Promise<void> {
		const container = this.contentEl;
		container.empty();
		container.addClass("mermaid-editor-container");

		// Toolbar
		const toolbar = container.createDiv({ cls: "mermaid-toolbar" });

		const loadBtn = toolbar.createEl("button", { text: "Load from note" });
		loadBtn.addEventListener("click", () => this.loadFromNote());

		const saveBtn = toolbar.createEl("button", { text: "Save to note" });
		saveBtn.addEventListener("click", () => this.saveToNote());

		const reloadBtn = toolbar.createEl("button", { text: "Reload buffer" });
		reloadBtn.addEventListener("click", () => this.reloadBuffer());

		const resetBtn = toolbar.createEl("button", { text: "Reset zoom" });
		resetBtn.addEventListener("click", () => {
			resetPanZoom(this.panZoomInstance);
		});

		this.originLabel = toolbar.createEl("span", { cls: "mermaid-origin-label" });

		// Split pane
		const splitPane = container.createDiv({ cls: "mermaid-split-pane" });

		// Left: code editor
		const codePane = splitPane.createDiv({ cls: "mermaid-code-pane" });
		codePane.style.flex = "1 1 50%";

		const textarea = codePane.createEl("textarea", {
			cls: "mermaid-code-editor",
			attr: { placeholder: "Enter Mermaid diagram code...", spellcheck: "false" },
		});
		textarea.value = DEFAULT_DIAGRAM;
		this.textarea = textarea;

		textarea.addEventListener("input", () => this.debouncedRender());

		// Resize handle
		const resizeHandle = splitPane.createDiv({ cls: "mermaid-resize-handle" });
		setupResizeHandle(
			resizeHandle,
			codePane,
			splitPane,
			() => {
				if (this.panZoomInstance) {
					try {
						this.panZoomInstance.resize();
						this.panZoomInstance.fit();
						this.panZoomInstance.center();
					} catch {
						// ignore
					}
				}
			},
			(cb) => this.register(cb),
		);

		// Right: preview
		const previewPane = splitPane.createDiv({ cls: "mermaid-preview-pane" });

		this.previewContent = previewPane.createDiv({ cls: "mermaid-preview-content" });
		this.errorDisplay = previewPane.createDiv({ cls: "mermaid-error-display" });

		// Restore origin metadata from plugin data
		this.sourceOrigin = this.plugin.settings.bufferOrigin ?? null;
		this.updateOriginLabel();

		// Try to restore from buffer file; if unavailable, keep the default diagram
		const buffered = await readBuffer(this.app.vault.adapter, this.plugin.bufferPath);
		if (buffered !== null && this.textarea) {
			this.textarea.value = buffered;
		}

		// Initialize mermaid and do first render
		initMermaid(this.plugin.settings.mermaidTheme);
		await this.renderDiagram();
	}

	async onClose(): Promise<void> {
		// Flush current content to buffer before closing
		if (this.textarea) {
			await writeBuffer(this.app.vault.adapter, this.plugin.bufferPath, this.textarea.value);
		}

		if (this.debounceTimer !== null) {
			clearTimeout(this.debounceTimer);
			this.debounceTimer = null;
		}
		this.panZoomInstance = destroyPanZoom(this.panZoomInstance);
		this.textarea = null;
		this.previewContent = null;
		this.errorDisplay = null;
		this.originLabel = null;
	}

	// ── Origin tracking ─────────────────────────────────────────────

	private updateOriginLabel(): void {
		if (!this.originLabel) return;
		if (this.sourceOrigin) {
			const name = this.sourceOrigin.filePath.split("/").pop() ?? this.sourceOrigin.filePath;
			const blockStr = this.sourceOrigin.blockIndex > 0
				? ` · block ${this.sourceOrigin.blockIndex + 1}`
				: "";
			this.originLabel.textContent = `Source: ${name}${blockStr}`;
		} else {
			this.originLabel.textContent = "";
		}
	}

	private persistOrigin(): void {
		this.plugin.settings.bufferOrigin = this.sourceOrigin;
		this.plugin.saveSettings();
	}

	// ── Debounced render + buffer write ─────────────────────────────

	private debouncedRender(): void {
		if (this.debounceTimer !== null) {
			clearTimeout(this.debounceTimer);
		}
		this.debounceTimer = setTimeout(() => {
			this.renderDiagram();
			if (this.textarea) {
				writeBuffer(this.app.vault.adapter, this.plugin.bufferPath, this.textarea.value);
			}
		}, this.plugin.settings.debounceMs);
	}

	private async renderDiagram(): Promise<void> {
		if (!this.textarea || !this.previewContent || !this.errorDisplay) return;

		this.panZoomInstance = destroyPanZoom(this.panZoomInstance);
		initMermaid(this.plugin.settings.mermaidTheme);
		this.panZoomInstance = await renderMermaid(
			this.textarea.value,
			this.previewContent,
			this.errorDisplay,
		);
	}

	// ── Load / Save to note ─────────────────────────────────────────

	private loadFromNote(): void {
		const result = loadMermaidFromNote(this.app);
		if (!result || !this.textarea) return;

		this.textarea.value = result.code;
		this.sourceOrigin = result.origin;
		this.persistOrigin();
		this.updateOriginLabel();
		this.debouncedRender();
	}

	private async saveToNote(): Promise<void> {
		if (!this.textarea) return;
		const result = await saveMermaidToNote(this.app, this.textarea.value, this.sourceOrigin);
		if (result) {
			this.sourceOrigin = result.origin;
			this.persistOrigin();
			this.updateOriginLabel();
		}
	}

	// ── Reload buffer ───────────────────────────────────────────────

	private async reloadBuffer(): Promise<void> {
		const content = await readBuffer(this.app.vault.adapter, this.plugin.bufferPath);
		if (content !== null && this.textarea) {
			this.textarea.value = content;
			this.debouncedRender();
			new Notice("Reloaded diagram from buffer file.");
		} else {
			new Notice("No buffer file found.");
		}
	}
}
