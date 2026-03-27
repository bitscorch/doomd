import { App, Modal, TFile, moment, setIcon } from "obsidian";
import { TaskStore } from "../store";
import { TaskSuggest } from "../suggest";

const STATUSES = ["inbox", "next", "active", "waiting", "someday", "done", "cancelled", "event", "meeting"];
const PRIORITIES = ["low", "normal", "high", "urgent"];

export class EditTaskModal extends Modal {
	private file: TFile;
	private store: TaskStore;

	constructor(app: App, file: TFile, store: TaskStore) {
		super(app);
		this.file = file;
		this.store = store;
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.addClass("doomd-edit-modal");

		const cache = this.app.metadataCache.getFileCache(this.file);
		const fm = cache?.frontmatter ?? {};

		// Title
		const h1 = cache?.headings?.find((h) => h.level === 1);
		const title = h1?.heading ?? fm.title ?? this.file.basename;
		contentEl.createEl("h3", { text: title });

		// Fields
		const fieldsEl = contentEl.createDiv({ cls: "doomd-edit-fields" });

		// Status
		this.addDropdownField(fieldsEl, "Status", STATUSES, fm.status || "inbox", (val) => {
			this.updateFrontmatter("status", val);
		});

		// Priority
		this.addDropdownField(fieldsEl, "Priority", PRIORITIES, fm.priority || "normal", (val) => {
			this.updateFrontmatter("priority", val);
		});

		// Start date
		const startVal = fm.start || "";
		const startDate = startVal ? moment(startVal).format("YYYY-MM-DD") : "";
		const startTime = startVal?.includes("T") ? moment(startVal).format("HH:mm") : "";

		const startDateField = fieldsEl.createDiv({ cls: "doomd-field" });
		startDateField.createEl("span", { text: "Start date", cls: "doomd-field-label" });
		const startDateInput = startDateField.createEl("input", { type: "date" });
		startDateInput.value = startDate;

		const startTimeField = fieldsEl.createDiv({ cls: "doomd-field" });
		startTimeField.createEl("span", { text: "Start time", cls: "doomd-field-label" });
		const startTimeInput = startTimeField.createEl("input", { type: "time" });
		startTimeInput.value = startTime;

		const updateStart = () => {
			if (!startDateInput.value) {
				this.updateFrontmatter("start", null);
				return;
			}
			if (startTimeInput.value) {
				const [h, m] = startTimeInput.value.split(":").map(Number);
				const val = moment(startDateInput.value).hour(h ?? 0).minute(m ?? 0).format("YYYY-MM-DDTHH:mm:ssZ");
				this.updateFrontmatter("start", val);
			} else {
				this.updateFrontmatter("start", startDateInput.value);
			}
		};
		startDateInput.addEventListener("change", updateStart);
		startTimeInput.addEventListener("change", updateStart);

		// End time
		const endVal = fm.end || "";
		const endTime = endVal?.includes("T") ? moment(endVal).format("HH:mm") : "";

		const endTimeField = fieldsEl.createDiv({ cls: "doomd-field" });
		endTimeField.createEl("span", { text: "End time", cls: "doomd-field-label" });
		const endTimeInput = endTimeField.createEl("input", { type: "time" });
		endTimeInput.value = endTime;
		endTimeInput.addEventListener("change", () => {
			if (!startDateInput.value || !endTimeInput.value) {
				this.updateFrontmatter("end", null);
				return;
			}
			const [h, m] = endTimeInput.value.split(":").map(Number);
			const val = moment(startDateInput.value).hour(h ?? 0).minute(m ?? 0).format("YYYY-MM-DDTHH:mm:ssZ");
			this.updateFrontmatter("end", val);
		});

		// Parent
		const parentField = fieldsEl.createDiv({ cls: "doomd-field" });
		parentField.createEl("span", { text: "Parent", cls: "doomd-field-label" });
		const parentInput = parentField.createEl("input", {
			type: "text",
			placeholder: "Search for parent task...",
		});
		parentInput.value = fm.parent || "";
		new TaskSuggest(this.app, parentInput, this.store, (val) => {
			this.updateFrontmatter("parent", val || null);
		});

		// Projects
		const projField = fieldsEl.createDiv({ cls: "doomd-field" });
		projField.createEl("span", { text: "Projects", cls: "doomd-field-label" });
		const projInput = projField.createEl("input", {
			type: "text",
			placeholder: '[[Project1]], [[Project2]]',
		});
		const projects = Array.isArray(fm.projects) ? fm.projects : [];
		projInput.value = projects.join(", ");
		projInput.addEventListener("change", () => {
			const val = projInput.value
				.split(",")
				.map((s: string) => s.trim())
				.filter(Boolean);
			this.updateFrontmatter("projects", val.length > 0 ? val : []);
		});

		// Tags
		const tagsField = fieldsEl.createDiv({ cls: "doomd-field" });
		tagsField.createEl("span", { text: "Tags", cls: "doomd-field-label" });
		const tagsInput = tagsField.createEl("input", {
			type: "text",
			placeholder: "tag1, tag2",
		});
		const tags = Array.isArray(fm.tags) ? fm.tags : [];
		tagsInput.value = tags.join(", ");
		tagsInput.addEventListener("change", () => {
			const val = tagsInput.value
				.split(",")
				.map((s: string) => s.trim())
				.filter(Boolean);
			this.updateFrontmatter("tags", val.length > 0 ? val : []);
		});

		// Body preview
		const bodyEl = contentEl.createDiv({ cls: "doomd-edit-body" });
		const content2 = await this.app.vault.cachedRead(this.file);
		const fmEnd = cache?.frontmatterPosition?.end?.line ?? 0;
		const bodyLines = content2.split("\n").slice(fmEnd + 1);
		// Skip the H1 line
		const bodyStart = bodyLines.findIndex((l) => !l.startsWith("# ") && l.trim() !== "");
		const bodyText = bodyLines.slice(Math.max(bodyStart, 0)).join("\n").trim();

		if (bodyText) {
			bodyEl.createDiv({ cls: "doomd-edit-body-label", text: "Body" });
			bodyEl.createDiv({ cls: "doomd-edit-body-text", text: bodyText });
		}

		// Button bar
		const buttonBar = contentEl.createDiv({ cls: "doomd-button-bar" });

		const goToBtn = buttonBar.createEl("button", { cls: "mod-cta" });
		const goToIcon = goToBtn.createSpan();
		setIcon(goToIcon, "external-link");
		goToBtn.appendText(" Go to note");
		goToBtn.addEventListener("click", () => {
			this.close();
			this.app.workspace.getLeaf("tab").openFile(this.file);
		});

		buttonBar.createEl("button", { text: "Done" }).addEventListener("click", () => this.close());
	}

	onClose() {
		this.contentEl.empty();
	}

	private addDropdownField(
		container: HTMLElement,
		label: string,
		options: string[],
		current: string,
		onChange: (value: string) => void,
	) {
		const field = container.createDiv({ cls: "doomd-field" });
		field.createEl("span", { text: label, cls: "doomd-field-label" });
		const select = field.createEl("select");
		for (const opt of options) {
			select.createEl("option", { text: opt, value: opt });
		}
		select.value = current;
		select.addEventListener("change", () => onChange(select.value));
	}

	private async updateFrontmatter(field: string, value: any): Promise<void> {
		await this.app.fileManager.processFrontMatter(this.file, (fm) => {
			fm[field] = value;
		});
	}
}
