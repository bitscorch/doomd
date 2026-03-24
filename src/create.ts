import { App, Modal, moment } from "obsidian";
import { EmbeddableEditor } from "./editor";
import { ParsedTask, parseTaskInput } from "./nlp";

export class CreateTaskModal extends Modal {
	private editor: EmbeddableEditor | null = null;
	private onSubmit: (parsed: ParsedTask, raw: string) => void;

	constructor(app: App, onSubmit: (parsed: ParsedTask, raw: string) => void) {
		super(app);
		this.onSubmit = onSubmit;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.addClass("doomd-create-modal");

		contentEl.createEl("h3", { text: "New task" });

		const editorContainer = contentEl.createDiv({ cls: "doomd-editor-container" });

		this.editor = new EmbeddableEditor(this.app, editorContainer, {
			placeholder: "Buy groceries tomorrow at 3pm @home #errands +[[Project]]",
			cls: "doomd-task-input",
			onSubmit: () => this.submit(),
			onEscape: () => this.close(),
		});

		setTimeout(() => this.editor?.focus(), 50);
	}

	private submit() {
		const raw = this.editor?.value.trim() ?? "";
		if (raw) {
			const parsed = parseTaskInput(raw);
			this.onSubmit(parsed, raw);
			this.close();
		}
	}

	onClose() {
		this.editor?.destroy();
		this.editor = null;
		this.contentEl.empty();
	}
}

export function generateTaskContent(parsed: ParsedTask, raw: string): string {
	const now = moment().format("YYYY-MM-DDTHH:mm:ss");

	const lines = [
		"---",
		"status: inbox",
		"priority: normal",
	];

	// Projects
	if (parsed.projects.length > 0) {
		lines.push("projects:");
		for (const p of parsed.projects) {
			lines.push(`  - "${p}"`);
		}
	} else {
		lines.push("projects: []");
	}

	lines.push("due:");
	lines.push("scheduled:");
	lines.push("recurrence:");

	// Tags
	if (parsed.tags.length > 0) {
		lines.push("tags:");
		for (const t of parsed.tags) {
			lines.push(`  - ${t}`);
		}
	} else {
		lines.push("tags: []");
	}

	// Contexts
	if (parsed.contexts.length > 0) {
		lines.push("contexts:");
		for (const c of parsed.contexts) {
			lines.push(`  - ${c}`);
		}
	}

	lines.push(`dateCreated: ${now}`);
	lines.push(`dateModified: ${now}`);
	lines.push("---");
	lines.push("");
	lines.push(`# ${raw}`);
	lines.push("");

	return lines.join("\n");
}

export function sanitizeFilename(title: string): string {
	return title
		.replace(/\[\[([^\]|]+)(\|[^\]]+)?\]\]/g, "$1")
		.replace(/[\\/:*?"<>|]/g, "")
		.replace(/\s+/g, " ")
		.trim();
}

export function generateFilename(title: string): string {
	const date = moment().format("YYYY-MM-DD-HHmm");
	const name = sanitizeFilename(title);
	return `${date} - ${name}.md`;
}

export async function ensureFolder(app: App, path: string): Promise<void> {
	const folder = app.vault.getAbstractFileByPath(path);
	if (!folder) {
		await app.vault.createFolder(path);
	}
}
