import {
	autocompletion,
	CompletionContext,
	CompletionResult,
	Completion,
	acceptCompletion,
	moveCompletionSelection,
	closeCompletion,
} from "@codemirror/autocomplete";
import { Extension, Prec } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { TaskStore } from "./store";

interface AutocompleteConfig {
	store: TaskStore;
}

function isBoundary(text: string, index: number): boolean {
	if (index === -1) return false;
	if (index === 0) return true;
	const prev = text[index - 1] ?? "";
	return !/\w/.test(prev);
}

export function createDoomdAutocomplete(config: AutocompleteConfig): Extension[] {
	const autocomplete = autocompletion({
		override: [
			async (context: CompletionContext): Promise<CompletionResult | null> => {
				const line = context.state.doc.lineAt(context.pos);
				const textBeforeCursor = line.text.slice(0, context.pos - line.from);

				const lastAt = textBeforeCursor.lastIndexOf("@");
				if (!isBoundary(textBeforeCursor, lastAt)) return null;

				const query = textBeforeCursor.slice(lastAt + 1);
				if (query.includes(" ")) return null;

				const options = getContextSuggestions(config.store, query);
				if (options.length === 0) return null;

				return {
					from: line.from + lastAt + 1,
					to: context.pos,
					options,
					validFor: /^[\w-]*$/,
				};
			},
		],
		activateOnTyping: true,
		closeOnBlur: true,
		maxRenderedOptions: 10,
	});

	const autocompleteKeymap = Prec.high(
		keymap.of([
			{ key: "ArrowDown", run: moveCompletionSelection(true) },
			{ key: "ArrowUp", run: moveCompletionSelection(false) },
			{ key: "Enter", run: acceptCompletion },
			{ key: "Tab", run: acceptCompletion },
			{ key: "Escape", run: closeCompletion },
		])
	);

	return [Prec.high(autocomplete), autocompleteKeymap];
}

function getContextSuggestions(store: TaskStore, query: string): Completion[] {
	const contexts = store.getAllContexts();
	const lowerQuery = query.toLowerCase();

	return contexts
		.filter((c) => c.toLowerCase().includes(lowerQuery))
		.slice(0, 10)
		.map((c) => ({
			label: c,
			apply: c + " ",
			type: "text",
			info: "Context",
		}));
}
