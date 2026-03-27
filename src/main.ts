import { Notice, Plugin, TFile, TFolder } from "obsidian";
import { DEFAULT_SETTINGS, DoomdSettings, DoomdSettingTab } from "./settings";
import { TaskStore } from "./store";
import { CreateTaskModal, generateTaskContent, generateFilename, ensureFolder } from "./create";
import { createDoomdAutocomplete } from "./autocomplete";
import { registerDoomdViews } from "./views/register";

export default class DoomdPlugin extends Plugin {
	settings: DoomdSettings;
	store: TaskStore;

	async onload() {
		await this.loadSettings();
		this.store = new TaskStore(this.app, this.settings.tasksFolder);

		// Register Bases views
		registerDoomdViews(this);

		// Load tasks when layout is ready
		this.app.workspace.onLayoutReady(() => {
			this.store.loadAll();
			console.log(`[doomd] Loaded ${this.store.getAll().length} tasks`);
		});

		// Watch for file changes in tasks folder
		this.registerEvent(
			this.app.vault.on("modify", (file) => {
				if (file instanceof TFile && file.path.startsWith(this.settings.tasksFolder)) {
					this.store.indexTask(file);
				}
			})
		);

		this.registerEvent(
			this.app.vault.on("create", (file) => {
				if (file instanceof TFile && file.path.startsWith(this.settings.tasksFolder)) {
					// Small delay to let metadata cache populate
					setTimeout(() => {
						if (file instanceof TFile) this.store.indexTask(file);
					}, 200);
				}
			})
		);

		this.registerEvent(
			this.app.vault.on("delete", (file) => {
				if (file instanceof TFile && file.path.startsWith(this.settings.tasksFolder)) {
					this.store.removeTask(file.path);
				}
			})
		);

		this.registerEvent(
			this.app.vault.on("rename", (file, oldPath) => {
				if (oldPath.startsWith(this.settings.tasksFolder)) {
					this.store.removeTask(oldPath);
				}
				if (file instanceof TFile && file.path.startsWith(this.settings.tasksFolder)) {
					this.store.indexTask(file);
				}
			})
		);

		// Command: create task
		this.addCommand({
			id: "create-task",
			name: "Create task",
			callback: () => {
				const extensions = createDoomdAutocomplete({
					store: this.store,
				});
				new CreateTaskModal(this.app, extensions, this.store, async (data) => {
					await ensureFolder(this.app, this.settings.tasksFolder);
					const filename = generateFilename(data.raw);
					const path = `${this.settings.tasksFolder}/${filename}`;
					const content = generateTaskContent(data);
					const file = await this.app.vault.create(path, content);
					new Notice(`Task created: ${data.parsed.title}`);
					await this.app.workspace.getLeaf(false).openFile(file);
				}).open();
			},
		});

		// Command: list all tasks (debug)
		this.addCommand({
			id: "list-tasks",
			name: "List all tasks",
			callback: () => {
				const tasks = this.store.getAll();
				if (tasks.length === 0) {
					new Notice("No tasks found");
					return;
				}
				const summary = tasks
					.map((t) => `[${t.status}] ${t.title}`)
					.join("\n");
				console.log(`[doomd] Tasks:\n${summary}`);
				new Notice(`Found ${tasks.length} tasks. Check console for details.`);
			},
		});

		// Settings tab
		this.addSettingTab(new DoomdSettingTab(this.app, this));
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<DoomdSettings>
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.store.setFolder(this.settings.tasksFolder);
	}
}
