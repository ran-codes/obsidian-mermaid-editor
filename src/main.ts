import { Plugin } from "obsidian";
import { MermaidView, VIEW_TYPE_MERMAID } from "./mermaid-view";
import {
	DEFAULT_SETTINGS,
	MermaidEditorSettings,
	MermaidSettingTab,
} from "./settings";

export default class MermaidEditorPlugin extends Plugin {
	settings: MermaidEditorSettings = DEFAULT_SETTINGS;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.registerView(VIEW_TYPE_MERMAID, (leaf) => new MermaidView(leaf, this));

		this.addRibbonIcon("git-compare", "Mermaid Live Editor", () => {
			this.activateView();
		});

		this.addCommand({
			id: "open-mermaid-editor",
			name: "Open editor",
			callback: () => {
				this.activateView();
			},
		});

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

	private async activateView(): Promise<void> {
		const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_MERMAID);
		if (existing.length > 0) {
			this.app.workspace.revealLeaf(existing[0]);
			return;
		}

		const leaf = this.app.workspace.getLeaf("tab");
		await leaf.setViewState({
			type: VIEW_TYPE_MERMAID,
			active: true,
		});
		this.app.workspace.revealLeaf(leaf);
	}
}
