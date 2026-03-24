import { App, PluginSettingTab, Setting } from "obsidian";
import DoomdPlugin from "./main";

export interface DoomdSettings {
	tasksFolder: string;
}

export const DEFAULT_SETTINGS: DoomdSettings = {
	tasksFolder: "task",
};

export class DoomdSettingTab extends PluginSettingTab {
	plugin: DoomdPlugin;

	constructor(app: App, plugin: DoomdPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Tasks folder")
			.setDesc("Folder where task files are stored")
			.addText((text) =>
				text
					.setPlaceholder("task")
					.setValue(this.plugin.settings.tasksFolder)
					.onChange(async (value) => {
						this.plugin.settings.tasksFolder = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
