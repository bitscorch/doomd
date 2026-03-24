import { App, TFile, TFolder } from "obsidian";
import { Task, parseTask } from "./task";

export class TaskStore {
	private app: App;
	private tasksFolder: string;
	private tasks: Map<string, Task> = new Map();

	constructor(app: App, tasksFolder: string) {
		this.app = app;
		this.tasksFolder = tasksFolder;
	}

	setFolder(folder: string) {
		this.tasksFolder = folder;
	}

	async loadAll(): Promise<void> {
		this.tasks.clear();
		const folder = this.app.vault.getAbstractFileByPath(this.tasksFolder);
		if (!(folder instanceof TFolder)) return;

		const files = this.getMarkdownFiles(folder);
		for (const file of files) {
			await this.loadTask(file);
		}
	}

	private getMarkdownFiles(folder: TFolder): TFile[] {
		const files: TFile[] = [];
		for (const child of folder.children) {
			if (child instanceof TFile && child.extension === "md") {
				files.push(child);
			} else if (child instanceof TFolder) {
				files.push(...this.getMarkdownFiles(child));
			}
		}
		return files;
	}

	async loadTask(file: TFile): Promise<void> {
		const content = await this.app.vault.read(file);
		const cache = this.app.metadataCache.getFileCache(file);
		const frontmatter = cache?.frontmatter ?? {};

		const bodyStart = cache?.frontmatterPosition?.end?.line ?? 0;
		const lines = content.split("\n");
		const body = lines.slice(bodyStart + 1).join("\n").trim();

		const task = parseTask(file.path, frontmatter, body);
		this.tasks.set(file.path, task);
	}

	removeTask(filePath: string): void {
		this.tasks.delete(filePath);
	}

	getAll(): Task[] {
		return Array.from(this.tasks.values());
	}

	getByStatus(status: string): Task[] {
		return this.getAll().filter((t) => t.status === status);
	}

	getByProject(project: string): Task[] {
		return this.getAll().filter((t) =>
			t.projects.some((p) => p.includes(project))
		);
	}

	getAllContexts(): string[] {
		const contexts = new Set<string>();
		for (const task of this.tasks.values()) {
			const fm = this.app.metadataCache.getCache(task.filePath)?.frontmatter;
			const taskContexts = fm?.contexts;
			if (Array.isArray(taskContexts)) {
				taskContexts.forEach((c: string) => contexts.add(c));
			}
		}
		return Array.from(contexts);
	}

	async updateTaskField(filePath: string, field: string, value: string): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (!(file instanceof TFile)) return;

		await this.app.fileManager.processFrontMatter(file, (fm) => {
			fm[field] = value;
		});

		await this.loadTask(file);
	}
}
