import * as chrono from "chrono-node";
import { moment } from "obsidian";

const DEFAULT_DURATION_MIN = 30;

export interface ParsedTask {
	title: string;
	projects: string[];
	tags: string[];
	contexts: string[];
	start: string | null;
	end: string | null;
	allDay: boolean;
}

export function parseTaskInput(input: string): ParsedTask {
	const projects: string[] = [];
	const tags: string[] = [];
	const contexts: string[] = [];

	let title = input;

	// Extract +[[project]] or +project (only when preceded by whitespace or at start)
	const projectWikiRegex = /(?<=\s|^)\+\[\[([^\]]+)\]\]/g;
	let match: RegExpExecArray | null;
	while ((match = projectWikiRegex.exec(input)) !== null) {
		projects.push(`[[${match[1]}]]`);
	}
	title = title.replace(projectWikiRegex, "");

	const projectPlainRegex = /(?<=\s|^)\+(\S+)/g;
	while ((match = projectPlainRegex.exec(title)) !== null) {
		projects.push(match[1]!);
	}
	title = title.replace(projectPlainRegex, "");

	// Extract #tag (only when preceded by whitespace or at start)
	const tagRegex = /(?<=\s|^)#(\S+)/g;
	while ((match = tagRegex.exec(title)) !== null) {
		tags.push(match[1]!);
	}
	title = title.replace(tagRegex, "");

	// Extract @context (only when preceded by whitespace or at start)
	const contextRegex = /(?<=\s|^)@(\S+)/g;
	while ((match = contextRegex.exec(title)) !== null) {
		contexts.push(match[1]!);
	}
	title = title.replace(contextRegex, "");

	// Parse date/time with chrono-node
	let start: string | null = null;
	let end: string | null = null;
	let allDay = false;

	const parsed = chrono.parse(title);
	if (parsed.length > 0 && parsed[0]) {
		const result = parsed[0];
		const hasTime = result.start.isCertain("hour");

		if (hasTime) {
			const startMoment = moment(result.start.date());
			start = startMoment.format("YYYY-MM-DDTHH:mm:ssZ");

			if (result.end) {
				end = moment(result.end.date()).format("YYYY-MM-DDTHH:mm:ssZ");
			} else {
				end = startMoment.clone().add(DEFAULT_DURATION_MIN, "minutes").format("YYYY-MM-DDTHH:mm:ssZ");
			}
		} else {
			start = moment(result.start.date()).format("YYYY-MM-DD");
			allDay = true;
		}

		title = title.slice(0, result.index) + title.slice(result.index + result.text.length);
	}

	// Clean up title
	title = title.replace(/\s+/g, " ").trim();

	return { title, projects, tags, contexts, start, end, allDay };
}
