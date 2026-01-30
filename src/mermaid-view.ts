import { ItemView, MarkdownView, Notice, WorkspaceLeaf } from "obsidian";
import mermaid from "mermaid";
import svgPanZoom from "svg-pan-zoom";
import type MermaidEditorPlugin from "./main";

export const VIEW_TYPE_MERMAID = "mermaid-live-view";

const DEFAULT_DIAGRAM = `graph TD
    A[Start] --> B{Is it working?}
    B -->|Yes| C[Great!]
    B -->|No| D[Debug]
    D --> B`;

const MERMAID_BLOCK_REGEX = /```mermaid\s*\n([\s\S]*?)```/;

let renderCounter = 0;

export class MermaidView extends ItemView {
	plugin: MermaidEditorPlugin;

	private textarea: HTMLTextAreaElement | null = null;
	private previewContent: HTMLElement | null = null;
	private errorDisplay: HTMLElement | null = null;
	private codePaneEl: HTMLElement | null = null;
	private splitPaneEl: HTMLElement | null = null;

	private panZoomInstance: ReturnType<typeof svgPanZoom> | null = null;
	private debounceTimer: ReturnType<typeof setTimeout> | null = null;

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
		return "git-compare";
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

		const resetBtn = toolbar.createEl("button", { text: "Reset zoom" });
		resetBtn.addEventListener("click", () => this.resetZoom());

		// Split pane
		const splitPane = container.createDiv({ cls: "mermaid-split-pane" });
		this.splitPaneEl = splitPane;

		// Left: code editor
		const codePane = splitPane.createDiv({ cls: "mermaid-code-pane" });
		codePane.style.flex = "1 1 50%";
		this.codePaneEl = codePane;

		const textarea = codePane.createEl("textarea", {
			cls: "mermaid-code-editor",
			attr: { placeholder: "Enter Mermaid diagram code...", spellcheck: "false" },
		});
		textarea.value = DEFAULT_DIAGRAM;
		this.textarea = textarea;

		textarea.addEventListener("input", () => this.debouncedRender());

		// Resize handle
		const resizeHandle = splitPane.createDiv({ cls: "mermaid-resize-handle" });
		this.setupResizeHandle(resizeHandle);

		// Right: preview
		const previewPane = splitPane.createDiv({ cls: "mermaid-preview-pane" });

		this.previewContent = previewPane.createDiv({ cls: "mermaid-preview-content" });
		this.errorDisplay = previewPane.createDiv({ cls: "mermaid-error-display" });

		// Initialize mermaid and do first render
		this.initMermaid();
		await this.renderDiagram();
	}

	async onClose(): Promise<void> {
		if (this.debounceTimer !== null) {
			clearTimeout(this.debounceTimer);
			this.debounceTimer = null;
		}
		this.destroyPanZoom();
		this.textarea = null;
		this.previewContent = null;
		this.errorDisplay = null;
		this.codePaneEl = null;
		this.splitPaneEl = null;
	}

	private initMermaid(): void {
		mermaid.initialize({
			startOnLoad: false,
			theme: this.plugin.settings.mermaidTheme as any,
			securityLevel: "loose",
		});
	}

	private debouncedRender(): void {
		if (this.debounceTimer !== null) {
			clearTimeout(this.debounceTimer);
		}
		this.debounceTimer = setTimeout(() => {
			this.renderDiagram();
		}, this.plugin.settings.debounceMs);
	}

	private async renderDiagram(): Promise<void> {
		if (!this.textarea || !this.previewContent || !this.errorDisplay) return;

		const code = this.textarea.value.trim();
		if (!code) {
			this.previewContent.empty();
			this.errorDisplay.textContent = "";
			this.destroyPanZoom();
			return;
		}

		// Re-init mermaid each render to pick up theme changes
		this.initMermaid();

		this.destroyPanZoom();

		// Clean up any orphan mermaid nodes from previous failed renders
		const orphans = document.querySelectorAll("[id^='mermaid-svg-']");
		orphans.forEach((el) => {
			if (!this.previewContent?.contains(el)) {
				el.remove();
			}
		});

		const id = `mermaid-svg-${++renderCounter}`;

		try {
			const { svg, bindFunctions } = await mermaid.render(id, code);
			this.previewContent.innerHTML = svg;
			this.errorDisplay.textContent = "";

			if (bindFunctions) {
				bindFunctions(this.previewContent);
			}

			// Ensure SVG fills its container (svg-pan-zoom removes viewBox)
			const svgEl = this.previewContent.querySelector("svg");
			if (svgEl) {
				svgEl.setAttribute("width", "100%");
				svgEl.setAttribute("height", "100%");
				svgEl.style.maxWidth = "100%";

				this.panZoomInstance = svgPanZoom(svgEl, {
					panEnabled: true,
					zoomEnabled: true,
					mouseWheelZoomEnabled: true,
					dblClickZoomEnabled: true,
					controlIconsEnabled: false,
					fit: true,
					center: true,
					minZoom: 0.1,
					maxZoom: 20,
				});
			}
		} catch (err: any) {
			// mermaid.render creates orphan nodes on failure — clean them up
			const orphan = document.getElementById(id);
			if (orphan && !this.previewContent.contains(orphan)) {
				orphan.remove();
			}

			this.errorDisplay.textContent =
				err?.message || err?.str || String(err);
		}
	}

	private destroyPanZoom(): void {
		if (this.panZoomInstance) {
			try {
				this.panZoomInstance.destroy();
			} catch {
				// ignore if already destroyed
			}
			this.panZoomInstance = null;
		}
	}

	private resetZoom(): void {
		if (this.panZoomInstance) {
			this.panZoomInstance.resetZoom();
			this.panZoomInstance.resetPan();
			this.panZoomInstance.center();
			this.panZoomInstance.fit();
		}
	}

	private setupResizeHandle(handle: HTMLElement): void {
		let startX: number;
		let startLeftWidth: number;

		const onMouseMove = (e: MouseEvent) => {
			if (!this.codePaneEl || !this.splitPaneEl) return;
			const totalWidth = this.splitPaneEl.clientWidth;
			const handleWidth = handle.clientWidth;
			let newLeftWidth = startLeftWidth + (e.clientX - startX);

			// Clamp between 15% and 85%
			const minWidth = totalWidth * 0.15;
			const maxWidth = totalWidth * 0.85 - handleWidth;
			newLeftWidth = Math.max(minWidth, Math.min(maxWidth, newLeftWidth));

			const pct = (newLeftWidth / totalWidth) * 100;
			this.codePaneEl.style.flex = `0 0 ${pct}%`;
		};

		const onMouseUp = () => {
			document.removeEventListener("mousemove", onMouseMove);
			document.removeEventListener("mouseup", onMouseUp);
			document.body.classList.remove("mermaid-resizing");

			// Re-fit pan/zoom after resize
			if (this.panZoomInstance) {
				try {
					this.panZoomInstance.resize();
					this.panZoomInstance.fit();
					this.panZoomInstance.center();
				} catch {
					// ignore
				}
			}
		};

		handle.addEventListener("mousedown", (e: MouseEvent) => {
			if (!this.codePaneEl) return;
			e.preventDefault();
			startX = e.clientX;
			startLeftWidth = this.codePaneEl.clientWidth;
			document.body.classList.add("mermaid-resizing");
			document.addEventListener("mousemove", onMouseMove);
			document.addEventListener("mouseup", onMouseUp);
		});

		// Clean up drag listeners on view close
		this.register(() => {
			document.removeEventListener("mousemove", onMouseMove);
			document.removeEventListener("mouseup", onMouseUp);
			document.body.classList.remove("mermaid-resizing");
		});
	}

	private loadFromNote(): void {
		const mdView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!mdView) {
			new Notice("No active markdown note found.");
			return;
		}

		const content = mdView.editor.getValue();
		const match = content.match(MERMAID_BLOCK_REGEX);
		if (!match) {
			new Notice("No mermaid code block found in the active note.");
			return;
		}

		if (this.textarea) {
			this.textarea.value = match[1].trimEnd();
			this.debouncedRender();
			new Notice("Loaded mermaid diagram from note.");
		}
	}

	private saveToNote(): void {
		const mdView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!mdView) {
			new Notice("No active markdown note found.");
			return;
		}

		if (!this.textarea) return;
		const code = this.textarea.value;
		const editor = mdView.editor;
		const content = editor.getValue();
		const match = MERMAID_BLOCK_REGEX.exec(content);

		if (match && match.index !== undefined) {
			// Replace existing block using editor API for undo support
			const from = editor.offsetToPos(match.index);
			const to = editor.offsetToPos(match.index + match[0].length);
			editor.replaceRange("```mermaid\n" + code + "\n```", from, to);
			new Notice("Updated mermaid block in note.");
		} else {
			// Append new block at the end
			const lastLine = editor.lastLine();
			const lastCh = editor.getLine(lastLine).length;
			const pos = { line: lastLine, ch: lastCh };
			editor.replaceRange("\n\n```mermaid\n" + code + "\n```\n", pos);
			new Notice("Appended new mermaid block to note.");
		}
	}
}
