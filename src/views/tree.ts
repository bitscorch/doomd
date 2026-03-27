import { TFile, BasesView, QueryController, BasesEntry, setIcon } from "obsidian";
import { EditTaskModal } from "./edit-modal";
import DoomdPlugin from "../main";

const STATUS_ICONS: Record<string, string> = {
	inbox: "circle",
	next: "circle-dot",
	active: "play-circle",
	waiting: "pause-circle",
	someday: "cloud",
	done: "check-circle-2",
	cancelled: "x-circle",
	event: "calendar-heart",
	meeting: "users",
};

const LINK_RE = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/;

interface TreeNode {
	entry: BasesEntry;
	title: string;
	status: string;
	children: TreeNode[];
	checkboxes: { text: string; checked: boolean }[];
}

export class TreeView extends BasesView {
	type = "doomdTree";
	private plugin: DoomdPlugin;
	private containerEl: HTMLElement;

	constructor(controller: QueryController, containerEl: HTMLElement, plugin: DoomdPlugin) {
		super(controller);
		this.plugin = plugin;
		this.containerEl = containerEl;
	}

	onload() {
		this.render();
	}

	onDataUpdated() {
		this.render();
	}

	private render() {
		this.containerEl.empty();
		this.containerEl.addClass("doomd-tree");

		const entries = this.data?.data ?? [];
		if (entries.length === 0) {
			this.containerEl.createDiv({
				cls: "doomd-tree-empty",
				text: "No tasks found.",
			});
			return;
		}

		const roots = this.buildTree(entries);

		const listEl = this.containerEl.createEl("ul", { cls: "doomd-tree-list" });
		for (const node of roots) {
			this.renderNode(listEl, node, 0);
		}
	}

	private buildTree(entries: BasesEntry[]): TreeNode[] {
		// Map file paths to nodes
		const nodeMap = new Map<string, TreeNode>();
		const allNodes: TreeNode[] = [];

		for (const entry of entries) {
			const fm = (entry as any).frontmatter ?? {};
			const title = this.getTitle(entry, fm);
			const status = fm.status || "inbox";
			const checkboxes = this.getCheckboxes(entry);

			const node: TreeNode = { entry, title, status, children: [], checkboxes };
			nodeMap.set(entry.file.path, node);
			allNodes.push(node);
		}

		// Build parent→child relationships
		const roots: TreeNode[] = [];

		for (const node of allNodes) {
			const fm = (node.entry as any).frontmatter ?? {};
			const parentLink = fm.parent as string | undefined;

			if (!parentLink) {
				roots.push(node);
				continue;
			}

			// Resolve the wikilink to a file path
			const parentPath = this.resolveLink(parentLink);
			const parentNode = parentPath ? nodeMap.get(parentPath) : undefined;

			if (parentNode) {
				parentNode.children.push(node);
			} else {
				// Parent not in query results — treat as root
				roots.push(node);
			}
		}

		return roots;
	}

	private resolveLink(link: string): string | null {
		// Extract path from wikilink: [[path]] or [[path|alias]]
		const match = LINK_RE.exec(link);
		const linkPath = match ? match[1]! : link;

		const file = this.app.metadataCache.getFirstLinkpathDest(linkPath, "");
		return file?.path ?? null;
	}

	private getTitle(entry: BasesEntry, fm: any): string {
		const cache = this.app.metadataCache.getFileCache(entry.file);
		const h1 = cache?.headings?.find((h) => h.level === 1);
		if (h1) return h1.heading;
		if (fm.title) return fm.title;
		return entry.file.basename;
	}

	private getCheckboxes(entry: BasesEntry): { text: string; checked: boolean }[] {
		const cache = this.app.metadataCache.getFileCache(entry.file);
		if (!cache?.listItems) return [];

		return cache.listItems
			.filter((item) => item.task !== undefined)
			.map((item) => ({
				text: item.task === "x" ? "" : "", // We need the actual text
				checked: item.task === "x",
			}));
	}

	private renderNode(parentEl: HTMLElement, node: TreeNode, depth: number) {
		const li = parentEl.createEl("li", { cls: "doomd-tree-node" });
		const hasChildren = node.children.length > 0 || node.checkboxes.length > 0;

		// Node row
		const row = li.createDiv({ cls: `doomd-tree-row doomd-tree-status-${node.status}` });

		// Collapse toggle
		if (hasChildren) {
			const toggle = row.createDiv({ cls: "doomd-tree-toggle expanded" });
			setIcon(toggle, "chevron-down");
			toggle.addEventListener("click", (e) => {
				e.stopPropagation();
				const childList = li.querySelector(":scope > .doomd-tree-children") as HTMLElement | null;
				if (!childList) return;
				const isExpanded = toggle.hasClass("expanded");
				toggle.toggleClass("expanded", !isExpanded);
				toggle.toggleClass("collapsed", isExpanded);
				childList.toggleClass("hidden", isExpanded);
				setIcon(toggle, isExpanded ? "chevron-right" : "chevron-down");
			});
		} else {
			row.createDiv({ cls: "doomd-tree-toggle-spacer" });
		}

		// Status icon
		const statusEl = row.createDiv({ cls: "doomd-tree-status" });
		setIcon(statusEl, STATUS_ICONS[node.status] ?? "circle");

		// Title
		const titleEl = row.createDiv({ cls: "doomd-tree-title" });
		titleEl.setText(node.title);
		titleEl.addEventListener("click", () => {
			new EditTaskModal(this.app, node.entry.file, this.plugin.store).open();
		});

		// Status label
		row.createDiv({ cls: "doomd-tree-status-label", text: node.status });

		// Children container
		if (hasChildren) {
			const childList = li.createEl("ul", { cls: "doomd-tree-children" });

			// Linked child tasks
			for (const child of node.children) {
				this.renderNode(childList, child, depth + 1);
			}

			// Inline checkboxes
			if (node.checkboxes.length > 0) {
				this.renderInlineCheckboxes(childList, node);
			}
		}
	}

	private renderInlineCheckboxes(parentEl: HTMLElement, node: TreeNode) {
		// Read actual checkbox text from the file's list items
		const cache = this.app.metadataCache.getFileCache(node.entry.file);
		if (!cache?.listItems) return;

		const checkboxItems = cache.listItems.filter((item) => item.task !== undefined);
		if (checkboxItems.length === 0) return;

		// We need the actual file content to extract checkbox text
		// Use the metadata cache positions to get the text
		for (const item of checkboxItems) {
			const li = parentEl.createEl("li", { cls: "doomd-tree-node" });
			const row = li.createDiv({ cls: "doomd-tree-row doomd-tree-checkbox-row" });

			// Spacer (no toggle for checkboxes)
			row.createDiv({ cls: "doomd-tree-toggle-spacer" });

			// Checkbox icon
			const checkEl = row.createDiv({ cls: "doomd-tree-checkbox" });
			const checked = item.task === "x";
			setIcon(checkEl, checked ? "check-square" : "square");
			if (checked) checkEl.addClass("checked");

			// Text — extract from position
			const textEl = row.createDiv({
				cls: `doomd-tree-checkbox-text${checked ? " checked" : ""}`,
			});

			// We'll read the line from cache position
			const lineNum = item.position.start.line;
			this.getLineText(node.entry.file, lineNum).then((text) => {
				// Strip the checkbox marker: "- [ ] " or "- [x] " and any leading whitespace
				const cleaned = text.replace(/^[\s]*[-*]\s*\[.\]\s*/, "");
				textEl.setText(cleaned);
			});
		}
	}

	private async getLineText(file: TFile, lineNum: number): Promise<string> {
		const content = await this.app.vault.cachedRead(file);
		const lines = content.split("\n");
		return lines[lineNum] ?? "";
	}
}
