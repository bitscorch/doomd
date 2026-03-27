import { App, PluginSettingTab, Setting } from "obsidian";
import DoomdPlugin from "./main";

export type AfterCreateAction = "save" | "save-tab" | "save-here";

export interface DoomdSettings {
	tasksFolder: string;
	projectsFolder: string;
	afterCreateAction: AfterCreateAction;
}

export const DEFAULT_SETTINGS: DoomdSettings = {
	tasksFolder: "task",
	projectsFolder: "proj",
	afterCreateAction: "save",
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

		new Setting(containerEl)
			.setName("Projects folder")
			.setDesc("Folder to suggest projects from when using + trigger")
			.addText((text) =>
				text
					.setPlaceholder("proj")
					.setValue(this.plugin.settings.projectsFolder)
					.onChange(async (value) => {
						this.plugin.settings.projectsFolder = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("After creating a task")
			.setDesc("What to do after saving a new task")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("save", "Just save")
					.addOption("save-tab", "Save & open in new tab")
					.addOption("save-here", "Save & open in current tab")
					.setValue(this.plugin.settings.afterCreateAction)
					.onChange(async (value) => {
						this.plugin.settings.afterCreateAction = value as AfterCreateAction;
						await this.plugin.saveSettings();
					})
			);
	}
}
