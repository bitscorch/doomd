import DoomdPlugin from "../main";
import { KanbanView } from "./kanban";
import { CalendarView } from "./calendar";
import { TreeView } from "./tree";

export function registerDoomdViews(plugin: DoomdPlugin): void {
	plugin.registerBasesView("doomdKanban", {
		name: "doomd Kanban",
		icon: "columns",
		factory: (controller, containerEl) => new KanbanView(controller, containerEl, plugin),
	});

	plugin.registerBasesView("doomdCalendar", {
		name: "doomd Calendar",
		icon: "calendar",
		factory: (controller, containerEl) => new CalendarView(controller, containerEl, plugin),
	});

	plugin.registerBasesView("doomdTree", {
		name: "doomd Tree",
		icon: "list-tree",
		factory: (controller, containerEl) => new TreeView(controller, containerEl, plugin),
	});
}
