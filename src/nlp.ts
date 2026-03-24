export interface ParsedTask {
	title: string;
	projects: string[];
	tags: string[];
	contexts: string[];
}

export function parseTaskInput(input: string): ParsedTask {
	const projects: string[] = [];
	const tags: string[] = [];
	const contexts: string[] = [];

	let title = input;

	// Extract +[[project]] or +project
	const projectWikiRegex = /\+\[\[([^\]]+)\]\]/g;
	let match;
	while ((match = projectWikiRegex.exec(input)) !== null) {
		projects.push(`[[${match[1]}]]`);
	}
	title = title.replace(projectWikiRegex, "");

	const projectPlainRegex = /\+(\S+)/g;
	while ((match = projectPlainRegex.exec(title)) !== null) {
		projects.push(match[1]);
	}
	title = title.replace(projectPlainRegex, "");

	// Extract #tag
	const tagRegex = /#(\S+)/g;
	while ((match = tagRegex.exec(title)) !== null) {
		tags.push(match[1]);
	}
	title = title.replace(tagRegex, "");

	// Extract @context
	const contextRegex = /@(\S+)/g;
	while ((match = contextRegex.exec(title)) !== null) {
		contexts.push(match[1]);
	}
	title = title.replace(contextRegex, "");

	// Clean up title
	title = title.replace(/\s+/g, " ").trim();

	return { title, projects, tags, contexts };
}
