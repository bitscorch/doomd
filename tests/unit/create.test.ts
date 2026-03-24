import { describe, it, expect, vi } from "vitest";

// Mock editor.ts to avoid Obsidian runtime dependency
vi.mock("../../src/editor", () => ({
	EmbeddableEditor: class {},
}));

import { sanitizeFilename, generateTaskContent } from "../../src/create";
import { ParsedTask } from "../../src/nlp";

describe("sanitizeFilename", () => {
	it("removes wikilink brackets", () => {
		expect(sanitizeFilename("Fix [[PKM]] docs")).toBe("Fix PKM docs");
	});

	it("removes wikilink with alias", () => {
		expect(sanitizeFilename("Fix [[kb_system|PKM]] docs")).toBe("Fix kb_system docs");
	});

	it("removes invalid filename characters", () => {
		expect(sanitizeFilename('Task: do "stuff" <now>')).toBe("Task do stuff now");
	});

	it("collapses whitespace", () => {
		expect(sanitizeFilename("Fix   the   bug")).toBe("Fix the bug");
	});

	it("trims whitespace", () => {
		expect(sanitizeFilename("  hello  ")).toBe("hello");
	});
});

describe("generateTaskContent", () => {
	const baseParsed: ParsedTask = {
		title: "Test task",
		projects: [],
		tags: [],
		contexts: [],
		due: null,
	};

	it("generates valid frontmatter with defaults", () => {
		const content = generateTaskContent(baseParsed, "Test task");
		expect(content).toContain("---");
		expect(content).toContain("status: inbox");
		expect(content).toContain("priority: normal");
		expect(content).toContain("projects: []");
		expect(content).toContain("tags: []");
		expect(content).toContain("due:");
		expect(content).toContain("# Test task");
	});

	it("includes projects in frontmatter", () => {
		const parsed = { ...baseParsed, projects: ["[[MyProject]]"] };
		const content = generateTaskContent(parsed, "Test +[[MyProject]]");
		expect(content).toContain('- "[[MyProject]]"');
		expect(content).not.toContain("projects: []");
	});

	it("includes tags in frontmatter", () => {
		const parsed = { ...baseParsed, tags: ["urgent", "work"] };
		const content = generateTaskContent(parsed, "Test #urgent #work");
		expect(content).toContain("  - urgent");
		expect(content).toContain("  - work");
	});

	it("includes contexts in frontmatter", () => {
		const parsed = { ...baseParsed, contexts: ["home"] };
		const content = generateTaskContent(parsed, "Test @home");
		expect(content).toContain("contexts:");
		expect(content).toContain("  - home");
	});

	it("includes due date when present", () => {
		const parsed = { ...baseParsed, due: "2026-03-25T15:00:00+02:00" };
		const content = generateTaskContent(parsed, "Test tomorrow at 3pm");
		expect(content).toContain("due: 2026-03-25T15:00:00+02:00");
	});

	it("includes timezone in dateCreated", () => {
		const content = generateTaskContent(baseParsed, "Test task");
		// Should have timezone offset like +02:00 or -05:00
		expect(content).toMatch(/dateCreated: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}/);
	});

	it("uses raw input for H1 heading", () => {
		const content = generateTaskContent(baseParsed, "Fix [[PKM]] @home #urgent");
		expect(content).toContain("# Fix [[PKM]] @home #urgent");
	});
});
