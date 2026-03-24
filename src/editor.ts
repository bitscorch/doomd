import { App, Constructor, Scope, TFile } from "obsidian";

declare const app: App;
import { EditorSelection, Extension, Prec } from "@codemirror/state";
import { EditorView, keymap, placeholder, ViewUpdate, tooltips } from "@codemirror/view";
import { around } from "monkey-around";

// Internal Obsidian type
interface ScrollableMarkdownEditor {
	app: App;
	containerEl: HTMLElement;
	editor: any;
	editorEl: HTMLElement;
	activeCM: any;
	owner: any;
	_loaded: boolean;
	set(value: string): void;
	onUpdate(update: ViewUpdate, changed: boolean): void;
	buildLocalExtensions(): Extension[];
	destroy(): void;
	unload(): void;
}

interface WidgetEditorView {
	editable: boolean;
	editMode: any;
	showEditor(): void;
	unload(): void;
}

function resolveEditorPrototype(app: App): Constructor<ScrollableMarkdownEditor> {
	// @ts-expect-error - internal API
	const widgetEditorView = app.embedRegistry.embedByExtension.md(
		{ app, containerEl: document.createElement("div") },
		null as unknown as TFile,
		""
	) as WidgetEditorView;

	widgetEditorView.editable = true;
	widgetEditorView.showEditor();

	const MarkdownEditor = Object.getPrototypeOf(
		Object.getPrototypeOf(widgetEditorView.editMode!)
	);

	widgetEditorView.unload();
	return MarkdownEditor.constructor as Constructor<ScrollableMarkdownEditor>;
}

export interface EmbeddableEditorOptions {
	value?: string;
	cls?: string;
	placeholder?: string;
	extensions?: Extension[];
	onSubmit?: (editor: EmbeddableEditor) => void;
	onEscape?: (editor: EmbeddableEditor) => void;
	onChange?: (value: string) => void;
}

export class EmbeddableEditor extends resolveEditorPrototype(app) {
	options: EmbeddableEditorOptions;
	scope: Scope;
	private uninstaller?: () => void;

	constructor(app: App, container: HTMLElement, options: EmbeddableEditorOptions = {}) {
		super(app, container, {
			app,
			onMarkdownScroll: () => {},
			getMode: () => "source",
		});

		this.options = options;
		this.scope = new Scope(this.app.scope);
		this.scope.register(["Mod"], "Enter", () => true);

		this.owner.editMode = this;
		this.owner.editor = this.editor;

		this.set(options.value || "");

		this.uninstaller = around(this.app.workspace, {
			setActiveLeaf: (oldMethod: any) => {
				return function (this: any, ...args: any[]) {
					if (!this.activeCM?.hasFocus) {
						oldMethod.call(this, ...args);
					}
				};
			},
		});

		this.editor.cm.contentDOM.addEventListener("focusin", () => {
			this.app.keymap.pushScope(this.scope);
			this.app.workspace.activeEditor = this.owner;
		});

		this.editor.cm.contentDOM.addEventListener("blur", () => {
			this.app.keymap.popScope(this.scope);
		});

		if (options.cls) {
			this.editorEl.classList.add(options.cls);
		}
	}

	get value(): string {
		return this.editor.cm.state.doc.toString();
	}

	setValue(value: string): void {
		this.set(value);
	}

	focus(): void {
		this.editor.cm.focus();
	}

	buildLocalExtensions(): Extension[] {
		const extensions = super.buildLocalExtensions();

		// Hide line numbers and gutters
		extensions.push(
			EditorView.theme({
				".cm-lineNumbers": { display: "none !important" },
				".cm-gutters": { display: "none !important" },
			})
		);

		extensions.push(tooltips({ parent: document.body }));

		if (this.options.placeholder) {
			extensions.push(placeholder(this.options.placeholder));
		}

		if (this.options.extensions?.length) {
			extensions.push(...this.options.extensions);
		}

		extensions.push(
			Prec.highest(
				keymap.of([
					{
						key: "Mod-Enter",
						run: () => {
							this.options.onSubmit?.(this);
							return true;
						},
					},
					{
						key: "Escape",
						run: () => {
							this.options.onEscape?.(this);
							return true;
						},
					},
				])
			)
		);

		return extensions;
	}

	onUpdate(update: ViewUpdate, changed: boolean): void {
		super.onUpdate(update, changed);
		if (changed) {
			this.options.onChange?.(this.value);
		}
	}

	destroy(): void {
		if (this._loaded) {
			this.unload();
		}
		this.app.keymap.popScope(this.scope);
		this.app.workspace.activeEditor = null;
		if (this.uninstaller) {
			this.uninstaller();
			this.uninstaller = undefined;
		}
		this.containerEl.empty();
		super.destroy();
	}
}
