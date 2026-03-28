import { describe, it, expect } from "vitest";
import { parseTaskInput } from "../../src/nlp";

describe("parseTaskInput", () => {
	describe("title extraction", () => {
		it("returns raw text as title when no triggers", () => {
			const result = parseTaskInput("Buy groceries");
			expect(result.title).toBe("Buy groceries");
		});

		it("strips project triggers from title", () => {
			const result = parseTaskInput("Fix bug +[[MyProject]]");
			expect(result.title).toBe("Fix bug");
		});

		it("strips plain project triggers from title", () => {
			const result = parseTaskInput("Fix bug +myproject");
			expect(result.title).toBe("Fix bug");
		});

		it("strips tag triggers from title", () => {
			const result = parseTaskInput("Fix bug #urgent");
			expect(result.title).toBe("Fix bug");
		});

		it("strips context triggers from title", () => {
			const result = parseTaskInput("Fix bug @work");
			expect(result.title).toBe("Fix bug");
		});

		it("strips all triggers and cleans whitespace", () => {
			const result = parseTaskInput("Fix bug +[[Proj]] @work #urgent");
			expect(result.title).toBe("Fix bug");
		});
	});

	describe("project extraction", () => {
		it("extracts wikilink project", () => {
			const result = parseTaskInput("Task +[[MyProject]]");
			expect(result.projects).toEqual(["[[MyProject]]"]);
		});

		it("extracts multiple wikilink projects", () => {
			const result = parseTaskInput("Task +[[ProjA]] +[[ProjB]]");
			expect(result.projects).toEqual(["[[ProjA]]", "[[ProjB]]"]);
		});

		it("extracts plain project", () => {
			const result = parseTaskInput("Task +myproject");
			expect(result.projects).toEqual(["myproject"]);
		});

		it("extracts project with folder path", () => {
			const result = parseTaskInput("Task +[[proj/PKM]]");
			expect(result.projects).toEqual(["[[proj/PKM]]"]);
		});

		it("returns empty array when no projects", () => {
			const result = parseTaskInput("Just a task");
			expect(result.projects).toEqual([]);
		});
	});

	describe("tag extraction", () => {
		it("extracts single tag", () => {
			const result = parseTaskInput("Task #urgent");
			expect(result.tags).toEqual(["urgent"]);
		});

		it("extracts multiple tags", () => {
			const result = parseTaskInput("Task #urgent #work");
			expect(result.tags).toEqual(["urgent", "work"]);
		});

		it("returns empty array when no tags", () => {
			const result = parseTaskInput("Just a task");
			expect(result.tags).toEqual([]);
		});
	});

	describe("context extraction", () => {
		it("extracts single context", () => {
			const result = parseTaskInput("Task @home");
			expect(result.contexts).toEqual(["home"]);
		});

		it("extracts multiple contexts", () => {
			const result = parseTaskInput("Task @home @work");
			expect(result.contexts).toEqual(["home", "work"]);
		});

		it("returns empty array when no contexts", () => {
			const result = parseTaskInput("Just a task");
			expect(result.contexts).toEqual([]);
		});
	});

	describe("date extraction", () => {
		it("extracts 'tomorrow' as all-day", () => {
			const result = parseTaskInput("Buy groceries tomorrow");
			expect(result.start).not.toBeNull();
			expect(result.allDay).toBe(true);
			expect(result.end).toBeNull();
			expect(result.title).toBe("Buy groceries");
		});

		it("extracts 'tomorrow at 3pm' as timed with 30min default end", () => {
			const result = parseTaskInput("Buy groceries tomorrow at 3pm");
			expect(result.start).not.toBeNull();
			expect(result.start).toContain("15:00");
			expect(result.end).not.toBeNull();
			expect(result.end).toContain("15:30");
			expect(result.allDay).toBe(false);
			expect(result.title).toBe("Buy groceries");
		});

		it("returns null start when no date", () => {
			const result = parseTaskInput("Buy groceries");
			expect(result.start).toBeNull();
			expect(result.end).toBeNull();
		});

		it("strips date text from title", () => {
			const result = parseTaskInput("Meeting next friday at 2pm");
			expect(result.start).not.toBeNull();
			expect(result.title).not.toContain("next friday");
			expect(result.title).not.toContain("at 2pm");
		});
	});

	describe("mid-word symbols are not treated as triggers", () => {
		it("does not extract @ from email addresses", () => {
			const result = parseTaskInput("Email user@domain.com about update");
			expect(result.contexts).toEqual([]);
			expect(result.title).toBe("Email user@domain.com about update");
		});

		it("does not extract + from math expressions", () => {
			const result = parseTaskInput("Calculate 2+2 for homework");
			expect(result.projects).toEqual([]);
			expect(result.title).toBe("Calculate 2+2 for homework");
		});

		it("does not extract # from C# mentions", () => {
			const result = parseTaskInput("Learn C#basics");
			expect(result.tags).toEqual([]);
			expect(result.title).toBe("Learn C#basics");
		});

		it("still extracts triggers preceded by space", () => {
			const result = parseTaskInput("Fix bug @work #urgent +project");
			expect(result.contexts).toEqual(["work"]);
			expect(result.tags).toEqual(["urgent"]);
			expect(result.projects).toEqual(["project"]);
			expect(result.title).toBe("Fix bug");
		});

		it("extracts triggers at start of string", () => {
			const result = parseTaskInput("#urgent fix the bug");
			expect(result.tags).toEqual(["urgent"]);
			expect(result.title).toBe("fix the bug");
		});
	});

	describe("combined input", () => {
		it("parses full input with all triggers", () => {
			const result = parseTaskInput("Buy groceries tomorrow at 3pm @home #errands +[[Shopping]]");
			expect(result.title).toBe("Buy groceries");
			expect(result.projects).toEqual(["[[Shopping]]"]);
			expect(result.tags).toEqual(["errands"]);
			expect(result.contexts).toEqual(["home"]);
			expect(result.start).not.toBeNull();
			expect(result.end).not.toBeNull();
		});

		it("handles empty input", () => {
			const result = parseTaskInput("");
			expect(result.title).toBe("");
			expect(result.projects).toEqual([]);
			expect(result.tags).toEqual([]);
			expect(result.contexts).toEqual([]);
			expect(result.start).toBeNull();
			expect(result.end).toBeNull();
		});
	});
});
