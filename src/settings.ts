import { App, PluginSettingTab, Setting } from "obsidian";
import DoomdPlugin from "./main";

export type AfterCreateAction = "save" | "save-tab" | "save-here";

export interface TaskDefaults {
	status: string;
	contexts: string;
	tags: string;
	projects: string;
}

export const DEFAULT_TASK_DEFAULTS: TaskDefaults = {
	status: "",
	contexts: "",
	tags: "",
	projects: "",
};

export interface DoomdSettings {
	tasksFolder: string;
	projectsFolder: string;
	afterCreateAction: AfterCreateAction;
	taskDefaults: TaskDefaults;
}

export const DEFAULT_SETTINGS: DoomdSettings = {
	tasksFolder: "task",
	projectsFolder: "proj",
	afterCreateAction: "save",
	taskDefaults: { ...DEFAULT_TASK_DEFAULTS },
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
			.setName("Default status")
			.setDesc("Default status for new tasks (e.g. inbox, next, active)")
			.addText((text) =>
				text
					.setPlaceholder("inbox")
					.setValue(this.plugin.settings.taskDefaults.status)
					.onChange(async (value) => {
						this.plugin.settings.taskDefaults.status = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Default contexts")
			.setDesc("Comma-separated contexts to add to every new task")
			.addText((text) =>
				text
					.setPlaceholder("work,shop,pc")
					.setValue(this.plugin.settings.taskDefaults.contexts)
					.onChange(async (value) => {
						this.plugin.settings.taskDefaults.contexts = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Default tags")
			.setDesc("Comma-separated tags to add to every new task")
			.addText((text) =>
				text
					.setPlaceholder("work,daily")
					.setValue(this.plugin.settings.taskDefaults.tags)
					.onChange(async (value) => {
						this.plugin.settings.taskDefaults.tags = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Default projects")
			.setDesc("Comma-separated projects to add to every new task")
			.addText((text) =>
				text
					.setPlaceholder("[[Euromonitor]]")
					.setValue(this.plugin.settings.taskDefaults.projects)
					.onChange(async (value) => {
						this.plugin.settings.taskDefaults.projects = value;
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
