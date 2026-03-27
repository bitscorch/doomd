import { Notice, TFile, BasesView, QueryController, BasesEntry, moment } from "obsidian";
import { Calendar, EventInput, EventDropArg } from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin, { EventResizeDoneArg } from "@fullcalendar/interaction";
import rrulePlugin from "@fullcalendar/rrule";
import DoomdPlugin from "../main";
import { sanitizeFilename, ensureFolder } from "../create";

const STATUS_COLORS: Record<string, string> = {
	inbox: "var(--text-muted)",
	next: "var(--interactive-accent)",
	active: "var(--color-green)",
	waiting: "var(--color-yellow)",
	someday: "var(--color-purple)",
	done: "var(--text-faint)",
};

/**
 * Convert stored recurrence format to rrule-compatible string.
 *
 * Stored: "DTSTART:20260405;FREQ=YEARLY;BYMONTH=4;BYMONTHDAY=5"
 * Output: "DTSTART:20260405\nRRULE:FREQ=YEARLY;BYMONTH=4;BYMONTHDAY=5"
 *
 * Stored: "FREQ=WEEKLY;BYDAY=MO"
 * Output: "DTSTART:20260327\nRRULE:FREQ=WEEKLY;BYDAY=MO"
 */
function toRRuleString(recurrence: string, fallbackStart: string): string {
	const dtMatch = recurrence.match(/^DTSTART:([^;]+);(.+)$/);
	if (dtMatch) {
		return `DTSTART:${dtMatch[1]}\nRRULE:${dtMatch[2]}`;
	}
	const dtstart = fallbackStart.replace(/-/g, "").replace(/T.*/, "");
	return `DTSTART:${dtstart}\nRRULE:${recurrence}`;
}

function computeDuration(start: string, end: string): string | undefined {
	const s = moment(start);
	const e = moment(end);
	if (!s.isValid() || !e.isValid()) return undefined;
	const diff = e.diff(s, "minutes");
	if (diff <= 0) return undefined;
	const hours = Math.floor(diff / 60);
	const minutes = diff % 60;
	return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export class CalendarView extends BasesView {
	type = "doomdCalendar";
	private plugin: DoomdPlugin;
	private containerEl: HTMLElement;
	private calendar: Calendar | null = null;

	/** Set of "YYYY-MM-DD:sourceFilePath" for materialized instances, used for dedup */
	private materializedDates = new Set<string>();

	constructor(controller: QueryController, containerEl: HTMLElement, plugin: DoomdPlugin) {
		super(controller);
		this.plugin = plugin;
		this.containerEl = containerEl;
	}

	onload() {
		this.render();
	}

	onDataUpdated() {
		if (this.calendar) {
			this.calendar.removeAllEvents();
			this.materializedDates.clear();
			for (const event of this.buildEvents()) {
				this.calendar.addEvent(event);
			}
		} else {
			this.render();
		}
	}

	private render() {
		this.containerEl.empty();
		this.containerEl.addClass("doomd-calendar");

		const calendarEl = this.containerEl.createDiv({ cls: "doomd-calendar-container" });

		this.calendar = new Calendar(calendarEl, {
			plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin, rrulePlugin],
			initialView: "dayGridMonth",
			headerToolbar: {
				left: "prev,next today",
				center: "title",
				right: "dayGridMonth,timeGridWeek,timeGridDay",
			},
			events: this.buildEvents(),
			editable: true,
			eventStartEditable: true,
			eventDurationEditable: true,
			height: "auto",
			nowIndicator: true,
			firstDay: 1,

			eventClick: (info) => {
				if (info.event.extendedProps.recurring) {
					this.handleRecurringClick(info.event);
				} else {
					const filePath = info.event.extendedProps.filePath as string;
					const file = this.app.vault.getAbstractFileByPath(filePath);
					if (file instanceof TFile) {
						this.app.workspace.getLeaf(false).openFile(file);
					}
				}
			},

			eventDrop: (info: EventDropArg) => {
				if (info.event.extendedProps.recurring) {
					info.revert();
					return;
				}
				this.handleEventMove(info.event.extendedProps.filePath, info.event);
			},

			eventResize: (info: EventResizeDoneArg) => {
				if (info.event.extendedProps.recurring) {
					info.revert();
					return;
				}
				this.handleEventMove(info.event.extendedProps.filePath, info.event);
			},

			eventDidMount: (info) => {
				if (!info.event.extendedProps.recurring) return;
				const eventDate = moment(info.event.start).format("YYYY-MM-DD");
				const key = `${eventDate}:${info.event.extendedProps.sourceFilePath}`;
				if (this.materializedDates.has(key)) {
					info.el.style.display = "none";
				}
			},
		});

		this.calendar.render();
	}

	private buildEvents(): EventInput[] {
		const entries = this.data?.data ?? [];
		const events: EventInput[] = [];

		// First pass: collect materialized dates for dedup
		this.materializedDates.clear();
		for (const entry of entries) {
			const fm = (entry as any).frontmatter ?? {};
			if (fm.recurrence) continue; // Skip templates in this pass
			const start = fm.start || fm.due || null;
			if (!start) continue;
			// If this task was spawned from a recurring template, track its date
			if (fm.recurrence_source) {
				const dateKey = moment(start).format("YYYY-MM-DD");
				this.materializedDates.add(`${dateKey}:${fm.recurrence_source}`);
			}
		}

		// Second pass: build events
		for (const entry of entries) {
			const fm = (entry as any).frontmatter ?? {};
			const title = this.getTitle(entry, fm);
			const status = fm.status || "inbox";
			const color = STATUS_COLORS[status] ?? STATUS_COLORS.inbox;

			if (fm.recurrence) {
				// Recurring template → virtual occurrences via rrule
				const anchorField = fm.recurrence_anchor || "start";
				const anchor = fm[anchorField] || fm.start || fm.due || null;
				if (!anchor) continue;

				const isAllDay = !anchor.includes("T");

				const event: EventInput = {
					title: `↻ ${title}`,
					rrule: toRRuleString(fm.recurrence, anchor),
					allDay: isAllDay,
					color,
					editable: false,
					extendedProps: {
						recurring: true,
						sourceFilePath: entry.file.path,
						sourceTitle: title,
					},
				};

				if (fm.end && fm.start) {
					const dur = computeDuration(fm.start, fm.end);
					if (dur) event.duration = dur;
				}

				events.push(event);
			} else {
				// Regular task
				const start = fm.start || fm.due || null;
				if (!start) continue;

				const isAllDay = !start.includes("T");
				const event: EventInput = {
					title,
					start,
					allDay: isAllDay,
					color,
					extendedProps: { filePath: entry.file.path },
				};

				if (fm.end) {
					event.end = fm.end;
				}

				events.push(event);
			}
		}

		return events;
	}

	private getTitle(entry: BasesEntry, fm: any): string {
		const cache = this.app.metadataCache.getFileCache(entry.file);
		const h1 = cache?.headings?.find((h) => h.level === 1);
		if (h1) return h1.heading;
		if (fm.title) return fm.title;
		return entry.file.basename;
	}

	private async handleRecurringClick(event: any): Promise<void> {
		const sourceFilePath = event.extendedProps.sourceFilePath as string;
		const sourceTitle = event.extendedProps.sourceTitle as string;
		const clickedDate = moment(event.start as Date);
		const dateStr = clickedDate.format("YYYY-MM-DD");

		// Check if a materialized file already exists for this date
		const existing = this.findMaterializedFile(sourceFilePath, dateStr);
		if (existing) {
			await this.app.workspace.getLeaf(false).openFile(existing);
			return;
		}

		// Materialize: read template and create a new task file
		const sourceFile = this.app.vault.getAbstractFileByPath(sourceFilePath);
		if (!(sourceFile instanceof TFile)) return;

		const cache = this.app.metadataCache.getFileCache(sourceFile);
		const sourceFm = cache?.frontmatter ?? {};
		const sourceContent = await this.app.vault.read(sourceFile);

		// Extract body (everything after frontmatter)
		const fmEnd = cache?.frontmatterPosition?.end?.line ?? 0;
		const lines = sourceContent.split("\n");
		const body = lines.slice(fmEnd + 1).join("\n").trim();

		// Build new task content
		const now = moment().format("YYYY-MM-DDTHH:mm:ssZ");
		const newLines = ["---"];
		newLines.push(`status: ${sourceFm.status || "inbox"}`);
		newLines.push(`priority: ${sourceFm.priority || "normal"}`);

		// Projects
		const projects = Array.isArray(sourceFm.projects) ? sourceFm.projects : [];
		if (projects.length > 0) {
			newLines.push("projects:");
			for (const p of projects) {
				newLines.push(`  - "${p}"`);
			}
		} else {
			newLines.push("projects: []");
		}

		// Date — use the clicked occurrence date
		const anchorField = sourceFm.recurrence_anchor || "start";
		if (anchorField === "scheduled") {
			newLines.push(`scheduled: ${dateStr}`);
			newLines.push(`start:`);
		} else {
			newLines.push(`start: ${dateStr}`);
		}
		newLines.push(`end:`);

		// No recurrence on the instance
		newLines.push(`recurrence:`);
		// Track which template spawned this
		newLines.push(`recurrence_source: ${sourceFilePath}`);

		// Tags
		const tags = Array.isArray(sourceFm.tags) ? sourceFm.tags : [];
		if (tags.length > 0) {
			newLines.push("tags:");
			for (const t of tags) {
				newLines.push(`  - ${t}`);
			}
		} else {
			newLines.push("tags: []");
		}

		newLines.push(`dateCreated: ${now}`);
		newLines.push(`dateModified: ${now}`);
		newLines.push("---");
		newLines.push("");

		if (body) {
			newLines.push(body);
		} else {
			newLines.push(`# ${sourceTitle}`);
			newLines.push("");
		}

		const filename = `${dateStr}-000000 - ${sanitizeFilename(sourceTitle)}.md`;
		const folder = this.plugin.settings.tasksFolder;
		await ensureFolder(this.app, folder);
		const path = `${folder}/${filename}`;

		const file = await this.app.vault.create(path, newLines.join("\n"));
		new Notice(`Created task: ${sourceTitle} (${dateStr})`);
		await this.app.workspace.getLeaf(false).openFile(file);
	}

	private findMaterializedFile(sourceFilePath: string, dateStr: string): TFile | null {
		const entries = this.data?.data ?? [];
		for (const entry of entries) {
			const fm = (entry as any).frontmatter ?? {};
			if (fm.recurrence_source !== sourceFilePath) continue;
			const start = fm.start || fm.scheduled || fm.due || null;
			if (start && moment(start).format("YYYY-MM-DD") === dateStr) {
				return entry.file;
			}
		}
		return null;
	}

	private async handleEventMove(filePath: string, event: any): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (!(file instanceof TFile)) return;

		const newStart = event.start as Date | null;
		const newEnd = event.end as Date | null;
		const allDay = event.allDay as boolean;

		await this.app.fileManager.processFrontMatter(file, (fm) => {
			if (newStart) {
				fm.start = allDay
					? moment(newStart).format("YYYY-MM-DD")
					: moment(newStart).format("YYYY-MM-DDTHH:mm");
			}
			if (newEnd) {
				fm.end = allDay
					? moment(newEnd).format("YYYY-MM-DD")
					: moment(newEnd).format("YYYY-MM-DDTHH:mm");
			}
		});
	}
}
