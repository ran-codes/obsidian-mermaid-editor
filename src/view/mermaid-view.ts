import { ItemView, Notice, TFile, WorkspaceLeaf, type ViewStateResult } from "obsidian";
import type MermaidEditorPlugin from "../main";
import type { BufferOrigin, MermaidViewState } from "../settings";
import { readBuffer, writeBuffer, getBufferMtime } from "./buffer";
import { saveMermaidToNote } from "./note-io";
import { initMermaid, renderMermaid } from "./renderer";
import { destroyPanZoom, type PanZoomInstance } from "./pan-zoom";
import { setupResizeHandle } from "./resize-handle";

export const VIEW_TYPE_MERMAID = "mermaid-live-view";

const DEFAULT_DIAGRAM = `graph TD
    A[Start] --> B{Is it working?}
    B -->|Yes| C[Great!]
    B -->|No| D[Debug]
    D --> B`;

const WATCH_INTERVAL_MS = 500;

function generateInstanceId(): string {
	const bytes = new Uint8Array(4);
	crypto.getRandomValues(bytes);
	return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export class MermaidView extends ItemView {
	plugin: MermaidEditorPlugin;
	instanceId: string = "";

	private pendingInitialCode: string | null = null;
	private textarea: HTMLTextAreaElement | null = null;
	private previewContent: HTMLElement | null = null;
	private errorDisplay: HTMLElement | null = null;

	private panZoomInstance: PanZoomInstance | null = null;
	private debounceTimer: ReturnType<typeof setTimeout> | null = null;

	private sourceOrigin: BufferOrigin | null = null;
	private openNoteAction: HTMLElement | null = null;
	private saveNoteAction: HTMLElement | null = null;

	private lastWriteTime = 0;
	private watchTimer: ReturnType<typeof setInterval> | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: MermaidEditorPlugin) {
		super(leaf);
		this.plugin = plugin;
		// Set classes immediately so CSS applies before onOpen
		this.containerEl.addClass("mermaid-editor-view");
		this.containerEl.addClass("is-scratch");
	}

	get bufferPath(): string {
		return this.plugin.bufferPathFor(this.instanceId);
	}

	getViewType(): string {
		return VIEW_TYPE_MERMAID;
	}

	getDisplayText(): string {
		if (this.sourceOrigin) {
			const name = this.sourceOrigin.filePath.split("/").pop() ?? this.sourceOrigin.filePath;
			const blockStr = this.sourceOrigin.blockIndex > 0
				? ` #${this.sourceOrigin.blockIndex + 1}`
				: "";
			return `Mermaid Editor (${name}${blockStr})`;
		}
		return "Mermaid Editor (Scratch)";
	}

	getIcon(): string {
		return "fish";
	}

	getState(): Record<string, unknown> {
		return {
			instanceId: this.instanceId,
			origin: this.sourceOrigin,
		};
	}

	async setState(state: unknown, result: ViewStateResult): Promise<void> {
		const viewState = state as Partial<MermaidViewState>;
		if (viewState.instanceId) {
			this.instanceId = viewState.instanceId;
		}
		if (viewState.origin !== undefined) {
			this.sourceOrigin = viewState.origin ?? null;
		}
		if (viewState.initialCode) {
			this.pendingInitialCode = viewState.initialCode;
		}

		// If onOpen already ran, apply state directly to the live view
		if (this.textarea && this.pendingInitialCode !== null) {
			this.textarea.value = this.pendingInitialCode;
			this.lastWriteTime = await writeBuffer(
				this.app.vault.adapter,
				this.bufferPath,
				this.pendingInitialCode,
			);
			this.pendingInitialCode = null;
			this.updateOriginLabel();
			initMermaid(this.plugin.settings.mermaidTheme);
			await this.renderDiagram();
		} else if (this.textarea) {
			// No initial code but origin may have changed
			this.updateOriginLabel();
		}

		await super.setState(state, result);
	}

	async onOpen(): Promise<void> {
		// Ensure instance ID exists (fresh editor with no setState call)
		if (!this.instanceId) {
			this.instanceId = generateInstanceId();
		}

		// Header actions (right side of tab header)
		this.openNoteAction = this.addAction("file-text", "Open note", () => this.openOriginNote());
		this.saveNoteAction = this.addAction("save", "Save to note", () => this.saveToNote());
		this.addAction("copy", "Copy buffer path", () => {
			navigator.clipboard.writeText(this.bufferPath);
			new Notice("Buffer path copied to clipboard.");
		});

		const container = this.contentEl;
		container.empty();
		container.addClass("mermaid-editor-container");

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

		// Restore origin label
		this.updateOriginLabel();

		// Content priority: pendingInitialCode > buffer file > DEFAULT_DIAGRAM
		if (this.pendingInitialCode !== null && this.textarea) {
			this.textarea.value = this.pendingInitialCode;
			// Write initial code to this instance's buffer file
			this.lastWriteTime = await writeBuffer(
				this.app.vault.adapter,
				this.bufferPath,
				this.pendingInitialCode,
			);
			this.pendingInitialCode = null;
		} else {
			const buffered = await readBuffer(this.app.vault.adapter, this.bufferPath);
			if (buffered !== null && this.textarea) {
				this.textarea.value = buffered;
			}
			// Snapshot current mtime so we don't false-trigger on open
			this.lastWriteTime = await getBufferMtime(this.app.vault.adapter, this.bufferPath) ?? Date.now();
		}

		// Initialize mermaid and do first render
		initMermaid(this.plugin.settings.mermaidTheme);
		await this.renderDiagram();

		// Start watching buffer for external changes
		this.startWatching();
	}

	async onClose(): Promise<void> {
		this.stopWatching();

		// Flush current content to buffer before closing
		if (this.textarea) {
			await writeBuffer(this.app.vault.adapter, this.bufferPath, this.textarea.value);
		}

		if (this.debounceTimer !== null) {
			clearTimeout(this.debounceTimer);
			this.debounceTimer = null;
		}
		this.panZoomInstance = destroyPanZoom(this.panZoomInstance);
		this.textarea = null;
		this.previewContent = null;
		this.errorDisplay = null;
		this.openNoteAction = null;
		this.saveNoteAction = null;
	}

	// ── Buffer file watching ────────────────────────────────────────

	private startWatching(): void {
		this.watchTimer = setInterval(() => this.checkForExternalChange(), WATCH_INTERVAL_MS);
	}

	private stopWatching(): void {
		if (this.watchTimer !== null) {
			clearInterval(this.watchTimer);
			this.watchTimer = null;
		}
	}

	private async checkForExternalChange(): Promise<void> {
		const mtime = await getBufferMtime(this.app.vault.adapter, this.bufferPath);
		if (mtime === null) return;
		if (mtime <= this.lastWriteTime) return;

		// External change detected — reload
		this.lastWriteTime = mtime;
		const content = await readBuffer(this.app.vault.adapter, this.bufferPath);
		if (content === null || !this.textarea) return;
		if (content === this.textarea.value) return; // content unchanged

		this.textarea.value = content;
		await this.renderDiagram();
	}

	// ── Origin tracking ─────────────────────────────────────────────

	private updateOriginLabel(): void {
		const container = this.contentEl;

		if (this.sourceOrigin) {
			container.removeClass("is-scratch");
			container.addClass("has-origin");
			this.containerEl.removeClass("is-scratch");
			this.containerEl.addClass("has-origin");
			if (this.openNoteAction) this.openNoteAction.style.display = "";
			if (this.saveNoteAction) this.saveNoteAction.style.display = "";
		} else {
			container.removeClass("has-origin");
			container.addClass("is-scratch");
			this.containerEl.removeClass("has-origin");
			this.containerEl.addClass("is-scratch");
			if (this.openNoteAction) this.openNoteAction.style.display = "none";
			if (this.saveNoteAction) this.saveNoteAction.style.display = "none";
		}
		// Update view header title directly (updateHeader is unreliable)
		const titleEl = this.containerEl.querySelector(".view-header-title");
		if (titleEl) {
			titleEl.textContent = this.getDisplayText();
		}
		// Also try the internal API for tab title
		(this.leaf as any).updateHeader?.();
	}

	// ── Debounced render + buffer write ─────────────────────────────

	private debouncedRender(): void {
		if (this.debounceTimer !== null) {
			clearTimeout(this.debounceTimer);
		}
		this.debounceTimer = setTimeout(async () => {
			this.renderDiagram();
			if (this.textarea) {
				this.lastWriteTime = await writeBuffer(
					this.app.vault.adapter,
					this.bufferPath,
					this.textarea.value,
				);
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

	// ── Open / Save to note ─────────────────────────────────────────

	private openOriginNote(): void {
		if (!this.sourceOrigin) {
			new Notice("No source note linked.");
			return;
		}
		const file = this.app.vault.getAbstractFileByPath(this.sourceOrigin.filePath);
		if (!(file instanceof TFile)) {
			new Notice(`Source file not found: ${this.sourceOrigin.filePath}`);
			return;
		}

		// Reuse existing tab if the note is already open
		const existing = this.app.workspace.getLeavesOfType("markdown")
			.find((leaf) => (leaf.view as any).file?.path === file.path);
		if (existing) {
			this.app.workspace.setActiveLeaf(existing, { focus: true });
		} else {
			this.app.workspace.getLeaf("tab").openFile(file);
		}
	}

	private async saveToNote(): Promise<void> {
		if (!this.textarea) return;
		const result = await saveMermaidToNote(this.app, this.textarea.value, this.sourceOrigin);
		if (result) {
			this.sourceOrigin = result.origin;
			this.updateOriginLabel();
		}
	}
}
