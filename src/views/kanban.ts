import { App, TFile, BasesView, QueryController, BasesEntry } from "obsidian";
import { renderTaskCard } from "./card";
import DoomdPlugin from "../main";

const STATUS_ORDER = ["inbox", "next", "active", "waiting", "someday", "done"];

export class KanbanView extends BasesView {
	type = "doomdKanban";
	private plugin: DoomdPlugin;
	private containerEl: HTMLElement;
	private draggedPath: string | null = null;

	constructor(controller: QueryController, containerEl: HTMLElement, plugin: DoomdPlugin) {
		super(controller);
		this.plugin = plugin;
		this.containerEl = containerEl;
	}

	onload() {
		this.render();
	}

	onDataUpdated() {
		this.render();
	}

	private render() {
		this.containerEl.empty();
		this.containerEl.addClass("doomd-kanban");

		const entries = this.data?.data ?? [];

		// Group entries by status
		const groups = new Map<string, { entry: BasesEntry; title: string; start: string | null; projects: string[] }[]>();
		for (const status of STATUS_ORDER) {
			groups.set(status, []);
		}

		for (const entry of entries) {
			// Read directly from frontmatter on the entry object
			const fm = (entry as any).frontmatter ?? {};
			const status = fm.status || "inbox";
			const start = fm.start || fm.due || null;
			const projects = Array.isArray(fm.projects) ? fm.projects : [];

			// Get title from H1 or frontmatter or filename
			const title = this.getTitle(entry, fm);

			if (!groups.has(status)) {
				groups.set(status, []);
			}
			groups.get(status)!.push({ entry, title, start, projects });
		}

		// Render columns
		for (const [status, tasks] of groups) {
			const column = this.containerEl.createDiv({ cls: "doomd-kanban-column" });
			if (tasks.length === 0) column.addClass("empty");

			// Header
			const header = column.createDiv({ cls: "doomd-kanban-column-header" });
			header.createSpan({ cls: "doomd-kanban-column-title", text: status });
			header.createSpan({ cls: "doomd-kanban-column-count", text: `${tasks.length}` });

			// Tasks container
			const tasksEl = column.createDiv({ cls: "doomd-kanban-tasks" });
			tasksEl.setAttribute("data-status", status);

			// Drop zone events
			tasksEl.addEventListener("dragover", (e) => {
				e.preventDefault();
				tasksEl.addClass("drag-over");
			});

			tasksEl.addEventListener("dragleave", (e) => {
				// Only remove if leaving the container entirely
				const related = e.relatedTarget as HTMLElement | null;
				if (!related || !tasksEl.contains(related)) {
					tasksEl.removeClass("drag-over");
				}
			});

			tasksEl.addEventListener("drop", async (e) => {
				e.preventDefault();
				tasksEl.removeClass("drag-over");

				if (this.draggedPath) {
					await this.updateTaskStatus(this.draggedPath, status);
					this.draggedPath = null;
				}
			});

			// Render cards
			for (const task of tasks) {
				const card = renderTaskCard(
					tasksEl,
					task.entry.file,
					task.title,
					status,
					task.start,
					task.projects,
					this.app,
				);

				card.addEventListener("dragstart", (e) => {
					this.draggedPath = task.entry.file.path;
					card.addClass("dragging");
					if (e.dataTransfer) {
						e.dataTransfer.setData("text/plain", task.entry.file.path);
						e.dataTransfer.effectAllowed = "move";
					}
				});

				card.addEventListener("dragend", () => {
					card.removeClass("dragging");
					this.draggedPath = null;
					// Remove all drag-over classes
					this.containerEl.querySelectorAll(".drag-over").forEach((el) => {
						el.removeClass("drag-over");
					});
				});
			}
		}
	}

	private getTitle(entry: BasesEntry, fm: any): string {
		// Try H1 from metadata cache
		const cache = this.app.metadataCache.getFileCache(entry.file);
		const h1 = cache?.headings?.find((h) => h.level === 1);
		if (h1) return h1.heading;

		// Fall back to frontmatter title
		if (fm.title) return fm.title;

		// Fall back to filename
		return entry.file.basename;
	}

	private async updateTaskStatus(filePath: string, newStatus: string): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (!(file instanceof TFile)) return;

		await this.app.fileManager.processFrontMatter(file, (fm) => {
			fm.status = newStatus;
		});
	}
}
