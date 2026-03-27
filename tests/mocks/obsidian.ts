// Mock for obsidian module in unit tests
import momentLib from "moment";

export const moment = momentLib;

export class App {}
export class Modal {
	app: any;
	contentEl: any = { empty() {}, addClass() {}, createEl() { return {}; }, createDiv() { return {}; } };
	constructor(app: any) { this.app = app; }
	open() {}
	close() {}
	onOpen() {}
	onClose() {}
}
export class Plugin {}
export class TFile { path = ""; extension = "md"; basename = ""; }
export class TFolder { children: any[] = []; }
export class Notice { constructor(_msg: string) {} }
export class Scope { register() {} }
export class BasesView { constructor(_controller: any) {} }
export class QueryController {}
export class AbstractInputSuggest<T> {
	constructor(_app: any, _inputEl: any) {}
	setValue(_value: string) {}
	getValue() { return ""; }
	close() {}
}
export function setIcon(_el: any, _icon: string) {}
