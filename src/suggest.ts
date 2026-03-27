import { AbstractInputSuggest, App } from "obsidian";
import { TaskStore } from "./store";

export class TaskSuggest extends AbstractInputSuggest<{ title: string; link: string }> {
	private store: TaskStore;
	private onPick: (value: string) => void;

	constructor(app: App, inputEl: HTMLInputElement, store: TaskStore, onPick: (value: string) => void) {
		super(app, inputEl);
		this.store = store;
		this.onPick = onPick;
	}

	getSuggestions(query: string): { title: string; link: string }[] {
		const lower = query.toLowerCase();
		return this.store
			.getAll()
			.map((t) => ({ title: t.title, link: `[[${t.title}]]` }))
			.filter((t) => t.title.toLowerCase().includes(lower))
			.slice(0, 20);
	}

	renderSuggestion(item: { title: string; link: string }, el: HTMLElement): void {
		el.setText(item.title);
	}

	selectSuggestion(item: { title: string; link: string }, _evt: MouseEvent | KeyboardEvent): void {
		this.setValue(item.link);
		this.onPick(item.link);
		this.close();
	}
}
