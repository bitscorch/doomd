import DoomdPlugin from "../main";
import { KanbanView } from "./kanban";

export function registerDoomdViews(plugin: DoomdPlugin): void {
	plugin.registerBasesView("doomdKanban", {
		name: "doomd Kanban",
		icon: "columns",
		factory: (controller, containerEl) => new KanbanView(controller, containerEl, plugin),
	});
}
