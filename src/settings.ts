import { App, PluginSettingTab, Setting } from "obsidian";
import type MermaidEditorPlugin from "./main";

export interface BufferOrigin {
	filePath: string;
	blockIndex: number;
}

export interface MermaidEditorSettings {
	debounceMs: number;
	mermaidTheme: string;
	bufferOrigin: BufferOrigin | null;
}

export const DEFAULT_SETTINGS: MermaidEditorSettings = {
	debounceMs: 300,
	mermaidTheme: "default",
	bufferOrigin: null,
};

export class MermaidSettingTab extends PluginSettingTab {
	plugin: MermaidEditorPlugin;

	constructor(app: App, plugin: MermaidEditorPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Render debounce")
			.setDesc("Delay in milliseconds before re-rendering after typing (0–1000).")
			.addSlider((slider) =>
				slider
					.setLimits(0, 1000, 50)
					.setValue(this.plugin.settings.debounceMs)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.debounceMs = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Mermaid theme")
			.setDesc("Theme used for diagram rendering.")
			.addDropdown((dropdown) =>
				dropdown
					.addOptions({
						default: "Default",
						dark: "Dark",
						forest: "Forest",
						neutral: "Neutral",
					})
					.setValue(this.plugin.settings.mermaidTheme)
					.onChange(async (value) => {
						this.plugin.settings.mermaidTheme = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
