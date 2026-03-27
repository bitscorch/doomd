export interface Task {
	filePath: string;
	title: string;
	status: string;
	priority: string;
	projects: string[];
	start: string | null;
	end: string | null;
	recurrence: string | null;
	parent: string | null;
	tags: string[];
	dateCreated: string | null;
	dateModified: string | null;
	body: string;
}

export function parseTask(filePath: string, frontmatter: Record<string, unknown>, body: string): Task {
	return {
		filePath,
		title: extractH1(body) ?? filePath.split("/").pop()?.replace(".md", "") ?? "",
		status: (frontmatter.status as string) ?? "inbox",
		priority: (frontmatter.priority as string) ?? "normal",
		projects: toStringArray(frontmatter.projects),
		start: (frontmatter.start as string) ?? null,
		end: (frontmatter.end as string) ?? null,
		recurrence: (frontmatter.recurrence as string) ?? null,
		parent: (frontmatter.parent as string) ?? null,
		tags: toStringArray(frontmatter.tags),
		dateCreated: (frontmatter.dateCreated as string) ?? null,
		dateModified: (frontmatter.dateModified as string) ?? null,
		body,
	};
}

function extractH1(body: string): string | null {
	const match = body.match(/^#\s+(.+)$/m);
	return match && match[1] ? match[1].trim() : null;
}

function toStringArray(value: unknown): string[] {
	if (Array.isArray(value)) return value.map(String);
	if (typeof value === "string") return value.split(",").map((s) => s.trim()).filter(Boolean);
	return [];
}
