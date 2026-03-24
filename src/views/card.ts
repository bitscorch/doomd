import { App, TFile, moment } from "obsidian";

const LINK_REGEX = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

export function renderTaskCard(
	container: HTMLElement,
	file: TFile,
	title: string,
	status: string,
	start: string | null,
	projects: string[],
	app: App,
): HTMLElement {
	const card = container.createDiv({ cls: "doomd-kanban-card" });
	card.setAttribute("draggable", "true");
	card.setAttribute("data-path", file.path);

	// Title with link rendering
	const titleEl = card.createDiv({ cls: "doomd-kanban-card-title" });
	renderTextWithLinks(titleEl, title, app);

	// Metadata line
	const metaEl = card.createDiv({ cls: "doomd-kanban-card-meta" });

	if (start) {
		const dateEl = metaEl.createSpan({ cls: "doomd-kanban-card-date" });
		const isAllDay = !start.includes("T");
		dateEl.setText(isAllDay ? start : moment(start).format("MMM D HH:mm"));
	}

	if (projects.length > 0) {
		const projEl = metaEl.createSpan({ cls: "doomd-kanban-card-projects" });
		projEl.setText(projects.map((p) => p.replace(/\[\[|\]\]/g, "")).join(", "));
	}

	// Click to open
	card.addEventListener("click", (e) => {
		if ((e.target as HTMLElement).closest("a")) return; // don't intercept link clicks
		app.workspace.getLeaf(false).openFile(file);
	});

	return card;
}

function renderTextWithLinks(container: HTMLElement, text: string, app: App): void {
	let lastIndex = 0;
	let match: RegExpExecArray | null;

	LINK_REGEX.lastIndex = 0;
	while ((match = LINK_REGEX.exec(text)) !== null) {
		const [full, path, alias] = match;
		const start = match.index;

		// Text before the link
		if (start > lastIndex) {
			container.appendText(text.slice(lastIndex, start));
		}

		// Render the link
		const displayText = alias || path!;
		const linkEl = container.createEl("a", {
			cls: "internal-link",
			text: displayText,
			attr: { "data-href": path!, href: path! },
		});

		linkEl.addEventListener("click", (e) => {
			e.preventDefault();
			e.stopPropagation();
			const resolved = app.metadataCache.getFirstLinkpathDest(path!, "");
			if (resolved) {
				app.workspace.getLeaf(e.ctrlKey || e.metaKey).openFile(resolved);
			}
		});

		// Hover preview
		linkEl.addEventListener("mouseover", (e) => {
			app.workspace.trigger("hover-link", {
				event: e,
				source: "doomd",
				hoverParent: container,
				targetEl: linkEl,
				linktext: path!,
				sourcePath: "",
			});
		});

		lastIndex = start + full!.length;
	}

	// Remaining text
	if (lastIndex < text.length) {
		container.appendText(text.slice(lastIndex));
	}
}
