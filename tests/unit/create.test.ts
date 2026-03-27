import { describe, it, expect, vi } from "vitest";

vi.mock("../../src/editor", () => ({
	EmbeddableEditor: class {},
}));

import { sanitizeFilename, generateTaskContent } from "../../src/create";
import { ParsedTask } from "../../src/nlp";

function makeData(overrides: Partial<{ parsed: Partial<ParsedTask>; raw: string; description: string; statusOverride: string | null; startOverride: string | null; endOverride: string | null; recurrenceOverride: string | null; parentOverride: string | null }> = {}) {
	const parsed: ParsedTask = {
		title: "Test task",
		projects: [],
		tags: [],
		contexts: [],
		start: null,
		end: null,
		allDay: false,
		...overrides.parsed,
	};
	return {
		parsed,
		raw: overrides.raw ?? "Test task",
		description: overrides.description ?? "",
		statusOverride: overrides.statusOverride ?? null,
		startOverride: overrides.startOverride ?? null,
		endOverride: overrides.endOverride ?? null,
		recurrenceOverride: overrides.recurrenceOverride ?? null,
		parentOverride: overrides.parentOverride ?? null,
	};
}

describe("sanitizeFilename", () => {
	it("unwraps wikilink brackets", () => {
		expect(sanitizeFilename("Fix [[PKM]] docs")).toBe("Fix PKM docs");
	});

	it("unwraps wikilink with alias to path + alias", () => {
		expect(sanitizeFilename("Fix [[kb_system|PKM]] docs")).toBe("Fix kb_system PKM docs");
	});

	it("removes only filesystem-invalid characters", () => {
		expect(sanitizeFilename('Task do "stuff"')).toBe("Task do stuff");
	});

	it("collapses whitespace", () => {
		expect(sanitizeFilename("Fix   the   bug")).toBe("Fix the bug");
	});

	it("trims whitespace", () => {
		expect(sanitizeFilename("  hello  ")).toBe("hello");
	});
});

describe("generateTaskContent", () => {
	it("generates valid frontmatter with defaults", () => {
		const content = generateTaskContent(makeData());
		expect(content).toContain("---");
		expect(content).toContain("status: inbox");
		expect(content).toContain("priority: normal");
		expect(content).toContain("projects: []");
		expect(content).toContain("tags: []");
		expect(content).toContain("start:");
		expect(content).toContain("end:");
		expect(content).toContain("# Test task");
	});

	it("includes projects in frontmatter", () => {
		const content = generateTaskContent(makeData({
			parsed: { projects: ["[[MyProject]]"] },
			raw: "Test +[[MyProject]]",
		}));
		expect(content).toContain('- "[[MyProject]]"');
		expect(content).not.toContain("projects: []");
	});

	it("includes tags in frontmatter", () => {
		const content = generateTaskContent(makeData({
			parsed: { tags: ["urgent", "work"] },
			raw: "Test #urgent #work",
		}));
		expect(content).toContain("  - urgent");
		expect(content).toContain("  - work");
	});

	it("includes contexts in frontmatter", () => {
		const content = generateTaskContent(makeData({
			parsed: { contexts: ["home"] },
			raw: "Test @home",
		}));
		expect(content).toContain("contexts:");
		expect(content).toContain("  - home");
	});

	it("includes start/end from NLP timed task", () => {
		const content = generateTaskContent(makeData({
			parsed: { start: "2026-03-25T15:00:00+02:00", end: "2026-03-25T15:30:00+02:00" },
			raw: "Test tomorrow at 3pm",
		}));
		expect(content).toContain("start: 2026-03-25T15:00:00+02:00");
		expect(content).toContain("end: 2026-03-25T15:30:00+02:00");
	});

	it("includes start only for all-day task", () => {
		const content = generateTaskContent(makeData({
			parsed: { start: "2026-03-25", allDay: true },
			raw: "Test tomorrow",
		}));
		expect(content).toContain("start: 2026-03-25");
		expect(content).toMatch(/end:\s*$/m);
	});

	it("start override takes precedence over NLP", () => {
		const content = generateTaskContent(makeData({
			parsed: { start: "2026-03-25T15:00:00+02:00" },
			startOverride: "2026-04-01T09:00:00+02:00",
		}));
		expect(content).toContain("start: 2026-04-01T09:00:00+02:00");
		expect(content).not.toContain("2026-03-25");
	});

	it("status override works", () => {
		const content = generateTaskContent(makeData({ statusOverride: "active" }));
		expect(content).toContain("status: active");
		expect(content).not.toContain("status: inbox");
	});

	it("recurrence override works", () => {
		const content = generateTaskContent(makeData({ recurrenceOverride: "FREQ=WEEKLY;BYDAY=MO" }));
		expect(content).toContain('recurrence: "FREQ=WEEKLY;BYDAY=MO"');
	});

	it("includes timezone in dateCreated", () => {
		const content = generateTaskContent(makeData());
		expect(content).toMatch(/dateCreated: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}/);
	});

	it("uses raw input for H1 heading", () => {
		const content = generateTaskContent(makeData({ raw: "Fix [[PKM]] @home #urgent" }));
		expect(content).toContain("# Fix [[PKM]] @home #urgent");
	});

	it("includes description below H1", () => {
		const content = generateTaskContent(makeData({
			description: "Get milk, bread, and eggs\nCheck if they have oat milk",
		}));
		expect(content).toContain("# Test task\n\nGet milk, bread, and eggs\nCheck if they have oat milk");
	});

	it("no description means no extra content", () => {
		const content = generateTaskContent(makeData({ description: "" }));
		const afterH1 = content.split("# Test task\n")[1];
		expect(afterH1?.trim()).toBe("");
	});

	it("parent override adds parent to frontmatter", () => {
		const content = generateTaskContent(makeData({ parentOverride: "[[Build website]]" }));
		expect(content).toContain('parent: "[[Build website]]"');
	});

	it("no parent override means no parent field", () => {
		const content = generateTaskContent(makeData());
		expect(content).not.toContain("parent:");
	});
});
