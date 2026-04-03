import { App, Menu, Modal, moment, setIcon } from "obsidian";
import { Extension } from "@codemirror/state";
import { EmbeddableEditor } from "./editor";
import { ParsedTask, parseTaskInput } from "./nlp";
import { TaskStore } from "./store";
import { AfterCreateAction, TaskDefaults } from "./settings";
import { TaskSuggest } from "./suggest";

export interface TaskFormData {
	parsed: ParsedTask;
	raw: string;
	description: string;
	statusOverride: string | null;
	startOverride: string | null;
	endOverride: string | null;
	recurrenceOverride: string | null;
	parentOverride: string | null;
}

export class CreateTaskModal extends Modal {
	private editor: EmbeddableEditor | null = null;
	private onSubmit: (data: TaskFormData, action: AfterCreateAction) => void;
	private defaultAction: AfterCreateAction;
	private onActionChange: (action: AfterCreateAction) => void;
	private extensions: Extension[];

	// UI elements
	private previewEl: HTMLElement;
	private detailsEl: HTMLElement;
	private expandIcon: HTMLElement;
	private isExpanded = false;

	// Action icons
	private dateIcon: HTMLElement;
	private statusIcon: HTMLElement;

	// Form overrides
	private statusOverride: string | null = null;
	private startOverride: string | null = null;
	private endOverride: string | null = null;
	private recurrenceOverride: string | null = null;
	private parentOverride: string | null = null;

	// Detail inputs
	private statusSelect: HTMLSelectElement | null = null;
	private startDateInput: HTMLInputElement | null = null;
	private startTimeInput: HTMLInputElement | null = null;
	private endTimeInput: HTMLInputElement | null = null;
	private recurrenceInput: HTMLInputElement | null = null;
	private parentInput: HTMLInputElement | null = null;

	private store: TaskStore;

	constructor(
		app: App,
		extensions: Extension[],
		store: TaskStore,
		defaultAction: AfterCreateAction,
		onActionChange: (action: AfterCreateAction) => void,
		onSubmit: (data: TaskFormData, action: AfterCreateAction) => void,
		initialStart?: string | null,
		initialEnd?: string | null,
	) {
		super(app);
		this.extensions = extensions;
		this.store = store;
		this.defaultAction = defaultAction;
		this.onActionChange = onActionChange;
		this.onSubmit = onSubmit;
		if (initialStart) this.startOverride = initialStart;
		if (initialEnd) this.endOverride = initialEnd;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.addClass("doomd-create-modal");

		contentEl.createEl("h3", { text: "Create task" });

		// Editor
		const editorContainer = contentEl.createDiv({ cls: "doomd-editor-container" });
		this.editor = new EmbeddableEditor(this.app, editorContainer, {
			placeholder: "Buy groceries tomorrow at 3pm @home #errands +[[Project]]",
			cls: "doomd-task-input",
			extensions: this.extensions,
			onSubmit: () => this.submit(this.defaultAction),
			onEscape: () => this.close(),
			onChange: (value) => this.updatePreview(value),
		});

		// Preview (always visible)
		this.previewEl = contentEl.createDiv({ cls: "doomd-preview" });

		// Action bar
		const actionBar = contentEl.createDiv({ cls: "doomd-action-bar" });
		this.dateIcon = this.createActionIcon(actionBar, "calendar", "Date", (e) => this.showDateMenu(e));
		this.statusIcon = this.createActionIcon(actionBar, "circle-dot", "Status", (e) => this.showStatusMenu(e));
		actionBar.createEl("div", { cls: "doomd-action-separator" });
		this.expandIcon = this.createActionIcon(actionBar, "chevron-down", "Details", () => this.toggleDetails());

		// Details (collapsed)
		this.detailsEl = contentEl.createDiv({ cls: "doomd-details hidden" });
		this.buildDetailsSection();

		// Buttons
		const buttonBar = contentEl.createDiv({ cls: "doomd-button-bar" });

		const saveGroup = buttonBar.createDiv({ cls: "doomd-save-group" });
		const saveBtn = saveGroup.createEl("button", {
			text: this.getSaveLabel(this.defaultAction),
			cls: "mod-cta doomd-save-main",
		});
		saveBtn.addEventListener("click", () => this.submit(this.defaultAction));

		const chevronBtn = saveGroup.createEl("button", { cls: "mod-cta doomd-save-chevron" });
		setIcon(chevronBtn, "chevron-down");
		chevronBtn.addEventListener("click", (e) => {
			const menu = new Menu();
			const actions: { action: AfterCreateAction; label: string }[] = [
				{ action: "save", label: "Save" },
				{ action: "save-tab", label: "Save & open in new tab" },
				{ action: "save-here", label: "Save & open here" },
			];
			for (const { action, label } of actions) {
				menu.addItem((item) => {
					item.setTitle(label);
					if (action === this.defaultAction) item.setIcon("check");
					item.onClick(() => {
						this.defaultAction = action;
						this.onActionChange(action);
						saveBtn.setText(this.getSaveLabel(action));
						this.submit(action);
					});
				});
			}
			menu.showAtMouseEvent(e);
		});

		buttonBar.createEl("button", { text: "Cancel" }).addEventListener("click", () => this.close());

		// Ctrl/Cmd+Enter anywhere in the modal triggers the default save action
		contentEl.addEventListener("keydown", (e) => {
			if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
				e.preventDefault();
				this.submit(this.defaultAction);
			}
		});

		// Show prefilled date state
		if (this.startOverride) {
			this.dateIcon.addClass("has-value");
			this.updatePreview();
		}

		setTimeout(() => this.editor?.focus(), 50);
	}

	private createActionIcon(parent: HTMLElement, icon: string, label: string, onClick: (e: MouseEvent) => void): HTMLElement {
		const btn = parent.createEl("button", { cls: "doomd-action-icon", attr: { "aria-label": label } });
		setIcon(btn, icon);
		btn.addEventListener("click", onClick);
		return btn;
	}

	// --- Date menu ---
	private showDateMenu(e: MouseEvent) {
		const menu = new Menu();

		menu.addItem((item) => item.setTitle("Today").setIcon("calendar").onClick(() => {
			this.setStart(moment().format("YYYY-MM-DD"), true);
		}));
		menu.addItem((item) => item.setTitle("Tomorrow").setIcon("calendar").onClick(() => {
			this.setStart(moment().add(1, "day").format("YYYY-MM-DD"), true);
		}));
		menu.addItem((item) => item.setTitle("This weekend").setIcon("calendar").onClick(() => {
			this.setStart(moment().day(6).format("YYYY-MM-DD"), true);
		}));
		menu.addItem((item) => item.setTitle("Next week").setIcon("calendar").onClick(() => {
			this.setStart(moment().add(1, "week").startOf("isoWeek").format("YYYY-MM-DD"), true);
		}));
		menu.addItem((item) => item.setTitle("Next month").setIcon("calendar").onClick(() => {
			this.setStart(moment().add(1, "month").startOf("month").format("YYYY-MM-DD"), true);
		}));
		menu.addSeparator();
		menu.addItem((item) => item.setTitle("Pick date & time...").setIcon("clock").onClick(() => {
			this.showDateTimePicker();
		}));

		if (this.startOverride) {
			menu.addSeparator();
			menu.addItem((item) => item.setTitle("Clear date").setIcon("x").onClick(() => {
				this.setStart(null, false);
			}));
		}

		menu.showAtMouseEvent(e);
	}

	private setStart(value: string | null, allDay: boolean) {
		this.startOverride = value;
		this.endOverride = allDay ? null : this.endOverride;
		this.dateIcon.toggleClass("has-value", !!value);
		this.updatePreview();
	}

	private showDateTimePicker() {
		const modal = new DateTimePickerModal(this.app, this.startOverride, this.endOverride, (start, end) => {
			this.startOverride = start;
			this.endOverride = end;
			this.dateIcon.toggleClass("has-value", !!start);
			this.updatePreview();
		});
		modal.open();
	}

	// --- Status menu ---
	private showStatusMenu(e: MouseEvent) {
		const menu = new Menu();
		const statuses = ["inbox", "next", "active", "waiting", "someday", "done", "cancelled", "event", "meeting"];

		for (const s of statuses) {
			menu.addItem((item) => {
				item.setTitle(s);
				if (this.statusOverride === s) item.setIcon("check");
				item.onClick(() => {
					this.statusOverride = s;
					this.statusIcon.toggleClass("has-value", s !== "inbox");
					if (this.statusSelect) this.statusSelect.value = s;
					this.updatePreview();
				});
			});
		}

		menu.showAtMouseEvent(e);
	}

	// --- Details panel ---
	private toggleDetails() {
		this.isExpanded = !this.isExpanded;
		if (this.isExpanded) {
			this.detailsEl.removeClass("hidden");
			setIcon(this.expandIcon, "chevron-up");
			this.syncNlpToForm();
		} else {
			this.detailsEl.addClass("hidden");
			setIcon(this.expandIcon, "chevron-down");
		}
	}

	private syncNlpToForm() {
		const value = this.editor?.value ?? "";
		const firstLine = value.split("\n")[0] ?? "";
		if (!firstLine.trim()) return;

		const parsed = parseTaskInput(firstLine);
		if (parsed.start && this.startDateInput && !this.startOverride) {
			this.startDateInput.value = moment(parsed.start).format("YYYY-MM-DD");
			if (!parsed.allDay && this.startTimeInput) {
				this.startTimeInput.value = moment(parsed.start).format("HH:mm");
			}
			if (parsed.end && this.endTimeInput) {
				this.endTimeInput.value = moment(parsed.end).format("HH:mm");
			}
		}
	}

	private buildDetailsSection() {
		// Status
		const statusField = this.detailsEl.createDiv({ cls: "doomd-field" });
		statusField.createEl("span", { text: "Status", cls: "doomd-field-label" });
		this.statusSelect = statusField.createEl("select");
		for (const s of ["inbox", "next", "active", "waiting", "someday", "done", "cancelled", "event", "meeting"]) {
			this.statusSelect.createEl("option", { text: s, value: s });
		}
		this.statusSelect.addEventListener("change", () => {
			this.statusOverride = this.statusSelect!.value;
			this.statusIcon.toggleClass("has-value", this.statusOverride !== "inbox");
			this.updatePreview();
		});

		// Date
		const dateField = this.detailsEl.createDiv({ cls: "doomd-field" });
		dateField.createEl("span", { text: "Date", cls: "doomd-field-label" });
		this.startDateInput = dateField.createEl("input", { type: "date" });
		this.startDateInput.addEventListener("change", () => this.rebuildFromForm());

		// Start time
		const startField = this.detailsEl.createDiv({ cls: "doomd-field" });
		startField.createEl("span", { text: "Start time", cls: "doomd-field-label" });
		this.startTimeInput = startField.createEl("input", { type: "time" });
		this.startTimeInput.addEventListener("change", () => this.rebuildFromForm());

		// End time
		const endField = this.detailsEl.createDiv({ cls: "doomd-field" });
		endField.createEl("span", { text: "End time", cls: "doomd-field-label" });
		this.endTimeInput = endField.createEl("input", { type: "time" });
		this.endTimeInput.addEventListener("change", () => this.rebuildFromForm());

		// Recurrence
		const recField = this.detailsEl.createDiv({ cls: "doomd-field" });
		recField.createEl("span", { text: "Recurrence", cls: "doomd-field-label" });
		this.recurrenceInput = recField.createEl("input", {
			type: "text",
			placeholder: "FREQ=WEEKLY;BYDAY=MO",
		});
		this.recurrenceInput.addEventListener("change", () => {
			this.recurrenceOverride = this.recurrenceInput!.value || null;
			this.updatePreview();
		});

		// Parent
		const parentField = this.detailsEl.createDiv({ cls: "doomd-field" });
		parentField.createEl("span", { text: "Parent", cls: "doomd-field-label" });
		this.parentInput = parentField.createEl("input", {
			type: "text",
			placeholder: "Search for parent task...",
		});
		new TaskSuggest(this.app, this.parentInput, this.store, (value) => {
			this.parentOverride = value || null;
			this.updatePreview();
		});
	}

	private rebuildFromForm() {
		const dateVal = this.startDateInput?.value;
		const startTime = this.startTimeInput?.value;
		const endTime = this.endTimeInput?.value;

		if (!dateVal) {
			this.startOverride = null;
			this.endOverride = null;
		} else if (startTime) {
			const [sh, sm] = startTime.split(":").map(Number);
			this.startOverride = moment(dateVal).hour(sh ?? 0).minute(sm ?? 0).format("YYYY-MM-DDTHH:mm:ssZ");
			if (endTime) {
				const [eh, em] = endTime.split(":").map(Number);
				this.endOverride = moment(dateVal).hour(eh ?? 0).minute(em ?? 0).format("YYYY-MM-DDTHH:mm:ssZ");
			} else {
				this.endOverride = moment(this.startOverride).add(30, "minutes").format("YYYY-MM-DDTHH:mm:ssZ");
			}
		} else {
			this.startOverride = dateVal;
			this.endOverride = null;
		}

		this.dateIcon.toggleClass("has-value", !!this.startOverride);
		this.updatePreview();
	}

	// --- Preview ---
	private updatePreview(value?: string) {
		this.previewEl.empty();

		const text = value ?? this.editor?.value ?? "";
		const firstLine = text.split("\n")[0] ?? "";
		const parsed = firstLine.trim() ? parseTaskInput(firstLine) : null;

		// Title
		if (parsed?.title) {
			this.addPreviewItem("pencil", parsed.title);
		}

		// Date (override > NLP)
		const start = this.startOverride ?? parsed?.start ?? null;
		const end = this.endOverride ?? parsed?.end ?? null;
		const allDay = !start?.includes("T");

		if (start) {
			if (allDay) {
				this.addPreviewItem("calendar", `Date: ${start}`);
			} else {
				const startFmt = moment(start).format("YYYY-MM-DD HH:mm");
				if (end) {
					this.addPreviewItem("calendar", `${startFmt} → ${moment(end).format("HH:mm")}`);
				} else {
					this.addPreviewItem("calendar", `Start: ${startFmt}`);
				}
			}
			this.dateIcon.addClass("has-value");
		} else {
			this.dateIcon.removeClass("has-value");
		}

		// Status
		if (this.statusOverride && this.statusOverride !== "inbox") {
			this.addPreviewItem("circle-dot", `Status: ${this.statusOverride}`);
		}

		// Projects
		if (parsed && parsed.projects.length > 0) {
			this.addPreviewItem("folder", `Projects: ${parsed.projects.join(", ")}`);
		}

		// Tags
		if (parsed && parsed.tags.length > 0) {
			this.addPreviewItem("tag", `Tags: ${parsed.tags.join(", ")}`);
		}

		// Contexts
		if (parsed && parsed.contexts.length > 0) {
			this.addPreviewItem("map-pin", `Context: ${parsed.contexts.join(", ")}`);
		}

		// Recurrence
		if (this.recurrenceOverride) {
			this.addPreviewItem("repeat", `Recurrence: ${this.recurrenceOverride}`);
		}

		// Parent
		if (this.parentOverride) {
			this.addPreviewItem("list-tree", `Parent: ${this.parentOverride}`);
		}

		// Description
		const lines = text.split("\n");
		if (lines.length > 1 && lines.slice(1).some((l) => l.trim())) {
			const descLines = lines.slice(1).filter((l) => l.trim()).length;
			this.addPreviewItem("file-text", `${descLines} line${descLines > 1 ? "s" : ""} of description`);
		}
	}

	private addPreviewItem(icon: string, text: string) {
		const item = this.previewEl.createDiv({ cls: "doomd-preview-item" });
		const iconEl = item.createSpan({ cls: "doomd-preview-icon" });
		setIcon(iconEl, icon);
		item.createSpan({ cls: "doomd-preview-text", text });
	}

	// --- Submit ---
	private submit(action: AfterCreateAction) {
		const value = this.editor?.value.trim() ?? "";
		if (!value) return;

		const lines = value.split("\n");
		const firstLine = lines[0] ?? "";
		const description = lines.slice(1).join("\n").trim();

		const parsed = parseTaskInput(firstLine);
		this.onSubmit({
			parsed,
			raw: firstLine,
			description,
			statusOverride: this.statusOverride,
			startOverride: this.startOverride,
			endOverride: this.endOverride,
			recurrenceOverride: this.recurrenceOverride,
			parentOverride: this.parentOverride,
		}, action);
		this.close();
	}

	private getSaveLabel(action: AfterCreateAction): string {
		switch (action) {
			case "save": return "Save";
			case "save-tab": return "Save & open tab";
			case "save-here": return "Save & open here";
		}
	}

	onClose() {
		this.editor?.destroy();
		this.editor = null;
		this.contentEl.empty();
	}
}

// --- Date/Time Picker Modal ---
class DateTimePickerModal extends Modal {
	private onSelect: (start: string | null, end: string | null) => void;
	private initialStart: string | null;
	private initialEnd: string | null;

	constructor(app: App, start: string | null, end: string | null, onSelect: (start: string | null, end: string | null) => void) {
		super(app);
		this.initialStart = start;
		this.initialEnd = end;
		this.onSelect = onSelect;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.addClass("doomd-create-modal");

		contentEl.createEl("h3", { text: "Set date & time" });

		// Date
		const dateField = contentEl.createDiv({ cls: "doomd-field" });
		dateField.createEl("span", { text: "Date", cls: "doomd-field-label" });
		const dateInput = dateField.createEl("input", { type: "date" });
		if (this.initialStart) {
			dateInput.value = moment(this.initialStart).format("YYYY-MM-DD");
		}

		// Start time
		const startField = contentEl.createDiv({ cls: "doomd-field" });
		startField.createEl("span", { text: "Start time", cls: "doomd-field-label" });
		const startTimeInput = startField.createEl("input", { type: "time" });
		if (this.initialStart?.includes("T")) {
			startTimeInput.value = moment(this.initialStart).format("HH:mm");
		}

		// End time
		const endField = contentEl.createDiv({ cls: "doomd-field" });
		endField.createEl("span", { text: "End time", cls: "doomd-field-label" });
		const endTimeInput = endField.createEl("input", { type: "time" });
		if (this.initialEnd) {
			endTimeInput.value = moment(this.initialEnd).format("HH:mm");
		}

		// Buttons
		const buttonBar = contentEl.createDiv({ cls: "doomd-button-bar" });
		const selectBtn = buttonBar.createEl("button", { text: "Select", cls: "mod-cta" });
		selectBtn.addEventListener("click", () => {
			if (!dateInput.value) {
				this.onSelect(null, null);
				this.close();
				return;
			}

			if (startTimeInput.value) {
				const [sh, sm] = startTimeInput.value.split(":").map(Number);
				const startM = moment(dateInput.value).hour(sh ?? 0).minute(sm ?? 0);
				const startStr = startM.format("YYYY-MM-DDTHH:mm:ssZ");

				let endStr: string | null = null;
				if (endTimeInput.value) {
					const [eh, em] = endTimeInput.value.split(":").map(Number);
					endStr = moment(dateInput.value).hour(eh ?? 0).minute(em ?? 0).format("YYYY-MM-DDTHH:mm:ssZ");
				} else {
					endStr = startM.clone().add(30, "minutes").format("YYYY-MM-DDTHH:mm:ssZ");
				}
				this.onSelect(startStr, endStr);
			} else {
				this.onSelect(dateInput.value, null);
			}
			this.close();
		});
		buttonBar.createEl("button", { text: "Cancel" }).addEventListener("click", () => this.close());
	}

	onClose() {
		this.contentEl.empty();
	}
}



// --- Helpers ---
function parseCSV(value: string): string[] {
	return value.split(",").map(s => s.trim()).filter(Boolean);
}

function mergeUnique(defaults: string[], parsed: string[]): string[] {
	return [...new Set([...defaults, ...parsed])];
}

export function generateTaskContent(data: TaskFormData, taskDefaults?: TaskDefaults): string {
	const now = moment().format("YYYY-MM-DDTHH:mm:ssZ");
	const { parsed, raw, description, statusOverride, startOverride, endOverride, recurrenceOverride, parentOverride } = data;

	const defaultContexts = parseCSV(taskDefaults?.contexts ?? "");
	const defaultTags = parseCSV(taskDefaults?.tags ?? "");
	const defaultProjects = parseCSV(taskDefaults?.projects ?? "");
	const defaultStatus = taskDefaults?.status || "";

	const lines = [
		"---",
		`status: ${statusOverride ?? (defaultStatus || "inbox")}`,
		"priority: normal",
	];

	const allProjects = mergeUnique(defaultProjects, parsed.projects);
	if (allProjects.length > 0) {
		lines.push("projects:");
		for (const p of allProjects) {
			lines.push(`  - "${p}"`);
		}
	} else {
		lines.push("projects: []");
	}

	const start = startOverride ?? parsed.start;
	if (start) {
		lines.push(`start: ${start}`);
	} else {
		lines.push("start:");
	}

	const end = endOverride ?? parsed.end;
	if (end) {
		lines.push(`end: ${end}`);
	} else {
		lines.push("end:");
	}

	if (recurrenceOverride) {
		lines.push(`recurrence: "${recurrenceOverride}"`);
	} else {
		lines.push("recurrence:");
	}

	if (parentOverride) {
		lines.push(`parent: "${parentOverride}"`);
	}

	const allTags = mergeUnique(defaultTags, parsed.tags);
	if (allTags.length > 0) {
		lines.push("tags:");
		for (const t of allTags) {
			lines.push(`  - ${t}`);
		}
	} else {
		lines.push("tags: []");
	}

	const allContexts = mergeUnique(defaultContexts, parsed.contexts);
	if (allContexts.length > 0) {
		lines.push("contexts:");
		for (const c of allContexts) {
			lines.push(`  - ${c}`);
		}
	}

	lines.push(`dateCreated: ${now}`);
	lines.push(`dateModified: ${now}`);
	lines.push("---");
	lines.push("");
	lines.push(`# ${raw}`);
	lines.push("");

	if (description) {
		lines.push(description);
		lines.push("");
	}

	return lines.join("\n");
}

export function sanitizeFilename(title: string): string {
	return title
		.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$1 $2")  // [[path|alias]] → path alias
		.replace(/\[\[([^\]]+)\]\]/g, "$1")                  // [[link]] → link
		.replace(/[\\/:*?"<>|]/g, "")                         // strip filesystem-invalid chars
		.replace(/\s+/g, " ")
		.trim();
}

export function generateFilename(title: string): string {
	const date = moment().format("YYYY-MM-DD-HHmmss");
	const name = sanitizeFilename(title);
	return `${date} - ${name}.md`;
}

export async function ensureFolder(app: App, path: string): Promise<void> {
	const folder = app.vault.getAbstractFileByPath(path);
	if (!folder) {
		await app.vault.createFolder(path);
	}
}
