import { Editor, MarkdownView, Menu, Notice, Plugin, normalizePath } from "obsidian";
import { MermaidView, VIEW_TYPE_MERMAID } from "./view/mermaid-view";
import { loadMermaidFromNote } from "./view/note-io";
import {
	DEFAULT_SETTINGS,
	MermaidEditorSettings,
	MermaidSettingTab,
} from "./settings";
import type { MermaidViewState } from "./settings";

export default class MermaidEditorPlugin extends Plugin {
	settings: MermaidEditorSettings = DEFAULT_SETTINGS;
	readonly bufferDir = normalizePath(".obsidian/plugins/mermaid-live-editor/buffers");

	bufferPathFor(instanceId: string): string {
		return normalizePath(`${this.bufferDir}/${instanceId}.mmd`);
	}

	async onload(): Promise<void> {
		await this.loadSettings();
		await this.ensureBufferDir();

		this.registerView(VIEW_TYPE_MERMAID, (leaf) => new MermaidView(leaf, this));

		this.addRibbonIcon("fish", "Mermaid Live Editor", () => {
			this.openFromActiveNote();
		});

		this.addCommand({
			id: "open-mermaid-editor",
			name: "Open blank mermaid editor",
			callback: () => {
				this.openNewEditor();
			},
		});

		this.addCommand({
			id: "open-mermaid-from-note",
			name: "Edit mermaid from current note",
			editorCheckCallback: (checking, editor, view) => {
				if (!(view instanceof MarkdownView)) return false;
				const content = editor.getValue();
				if (!/```mermaid\s*\n/.test(content)) return false;
				if (checking) return true;
				const result = loadMermaidFromNote(this.app);
				if (result) {
					this.openNewEditor({
						instanceId: "",
						origin: result.origin,
						initialCode: result.code,
					});
				}
				return true;
			},
		});

		this.addCommand({
			id: "clear-mermaid-buffers",
			name: "Clear orphaned buffer files",
			callback: () => {
				this.clearOrphanedBuffers();
			},
		});

		this.addCommand({
			id: "clear-all-mermaid-buffers",
			name: "Clear all buffer files",
			callback: () => {
				this.clearAllBuffers();
			},
		});

		this.registerEvent(
			this.app.workspace.on("editor-menu", (menu, editor, view) => {
				const content = editor.getValue();
				const blocks = this.findMermaidBlocks(content);
				if (blocks.length === 0) return;
				const file = view.file;
				if (!file) return;

				if (blocks.length === 1) {
					menu.addItem((item) => {
						item.setTitle("Edit in Mermaid Editor")
							.setIcon("fish")
							.onClick(() => {
								this.openNewEditor({
									instanceId: "",
									origin: { filePath: file.path, blockIndex: 0 },
									initialCode: blocks[0].code,
								});
							});
					});
				} else {
					for (const block of blocks) {
						menu.addItem((item) => {
							item.setTitle(`Edit mermaid block ${block.blockIndex + 1}`)
								.setIcon("fish")
								.onClick(() => {
									this.openNewEditor({
										instanceId: "",
										origin: { filePath: file.path, blockIndex: block.blockIndex },
										initialCode: block.code,
									});
								});
						});
					}
				}
			}),
		);

		this.addSettingTab(new MermaidSettingTab(this.app, this));
	}

	onunload(): void {
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_MERMAID);
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	private async ensureBufferDir(): Promise<void> {
		const adapter = this.app.vault.adapter;
		if (!(await adapter.exists(this.bufferDir))) {
			await adapter.mkdir(this.bufferDir);
		}
	}

	async openNewEditor(state?: Partial<MermaidViewState>): Promise<void> {
		// Enforce one editor per upstream source (file + block)
		if (state?.origin) {
			const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_MERMAID)
				.find((leaf) => {
					const vs = leaf.view.getState() as Record<string, any>;
					return vs.origin?.filePath === state.origin!.filePath
						&& vs.origin?.blockIndex === state.origin!.blockIndex;
				});
			if (existing) {
				this.app.workspace.revealLeaf(existing);
				return;
			}
		}

		const leaf = this.app.workspace.getLeaf("tab");
		await leaf.setViewState({
			type: VIEW_TYPE_MERMAID,
			active: true,
			state: state ?? {},
		});
		this.app.workspace.revealLeaf(leaf);
	}

	private async openFromActiveNote(): Promise<void> {
		// First try the editor-based path (works in source/live-preview mode)
		const result = loadMermaidFromNote(this.app, { silent: true });
		if (result) {
			await this.openNewEditor({
				instanceId: "",
				origin: result.origin,
				initialCode: result.code,
			});
			return;
		}

		// Fallback: read the file directly from the vault (works in reading view
		// or any state where getActiveViewOfType(MarkdownView) returns null)
		const file = this.app.workspace.getActiveFile();
		if (file && file.extension === "md") {
			const content = await this.app.vault.read(file);
			const match = /```mermaid\s*\n([\s\S]*?)```/.exec(content);
			if (match) {
				await this.openNewEditor({
					instanceId: "",
					origin: { filePath: file.path, blockIndex: 0 },
					initialCode: match[1].trimEnd(),
				});
				return;
			}
		}

		// No mermaid block found — open blank editor
		await this.openNewEditor();
	}

	private findMermaidBlocks(content: string): Array<{
		code: string; blockIndex: number; start: number; end: number;
	}> {
		const regex = /```mermaid\s*\n([\s\S]*?)```/g;
		const blocks: Array<{ code: string; blockIndex: number; start: number; end: number }> = [];
		let match: RegExpExecArray | null;
		while ((match = regex.exec(content)) !== null) {
			if (match.index === undefined) continue;
			blocks.push({
				code: match[1].trimEnd(),
				blockIndex: blocks.length,
				start: match.index,
				end: match.index + match[0].length,
			});
		}
		return blocks;
	}

	private async clearOrphanedBuffers(): Promise<void> {
		const adapter = this.app.vault.adapter;
		if (!(await adapter.exists(this.bufferDir))) {
			new Notice("No buffer directory found.");
			return;
		}

		const listing = await adapter.list(this.bufferDir);
		const openIds = new Set(
			this.app.workspace
				.getLeavesOfType(VIEW_TYPE_MERMAID)
				.map((leaf) => (leaf.view as unknown as MermaidView).instanceId),
		);

		let removed = 0;
		for (const filePath of listing.files) {
			const fileName = filePath.split("/").pop() ?? "";
			const id = fileName.replace(/\.mmd$/, "");
			if (!openIds.has(id)) {
				await adapter.remove(filePath);
				removed++;
			}
		}

		new Notice(removed > 0
			? `Removed ${removed} orphaned buffer file${removed > 1 ? "s" : ""}.`
			: "No orphaned buffer files found.",
		);
	}

	private async clearAllBuffers(): Promise<void> {
		const adapter = this.app.vault.adapter;
		if (!(await adapter.exists(this.bufferDir))) {
			new Notice("No buffer directory found.");
			return;
		}

		const listing = await adapter.list(this.bufferDir);
		let removed = 0;
		for (const filePath of listing.files) {
			await adapter.remove(filePath);
			removed++;
		}

		new Notice(removed > 0
			? `Removed ${removed} buffer file${removed > 1 ? "s" : ""}.`
			: "No buffer files found.",
		);
	}
}
