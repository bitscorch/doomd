import { TFile, BasesView, QueryController, BasesEntry, moment } from "obsidian";
import { Calendar, EventInput, EventDropArg } from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin, { EventResizeDoneArg } from "@fullcalendar/interaction";
import DoomdPlugin from "../main";

const STATUS_COLORS: Record<string, string> = {
	inbox: "var(--text-muted)",
	next: "var(--interactive-accent)",
	active: "var(--color-green)",
	waiting: "var(--color-yellow)",
	someday: "var(--color-purple)",
	done: "var(--text-faint)",
};

export class CalendarView extends BasesView {
	type = "doomdCalendar";
	private plugin: DoomdPlugin;
	private containerEl: HTMLElement;
	private calendar: Calendar | null = null;

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
			plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
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
			firstDay: 1, // Monday

			eventClick: (info) => {
				const filePath = info.event.extendedProps.filePath as string;
				const file = this.app.vault.getAbstractFileByPath(filePath);
				if (file instanceof TFile) {
					this.app.workspace.getLeaf(false).openFile(file);
				}
			},

			eventDrop: (info: EventDropArg) => {
				this.handleEventMove(info.event.extendedProps.filePath, info.event);
			},

			eventResize: (info: EventResizeDoneArg) => {
				this.handleEventMove(info.event.extendedProps.filePath, info.event);
			},
		});

		this.calendar.render();
	}

	private buildEvents(): EventInput[] {
		const entries = this.data?.data ?? [];
		const events: EventInput[] = [];

		for (const entry of entries) {
			const fm = (entry as any).frontmatter ?? {};
			const start = fm.start || fm.due || null;
			if (!start) continue; // Skip tasks without a date

			const title = this.getTitle(entry, fm);
			const status = fm.status || "inbox";
			const isAllDay = !start.includes("T");

			const event: EventInput = {
				title,
				start,
				allDay: isAllDay,
				color: STATUS_COLORS[status] ?? STATUS_COLORS.inbox,
				extendedProps: { filePath: entry.file.path },
			};

			if (fm.end) {
				event.end = fm.end;
			}

			events.push(event);
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
