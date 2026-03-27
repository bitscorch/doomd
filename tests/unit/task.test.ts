import { describe, it, expect } from "vitest";
import { parseTask } from "../../src/task";

describe("parseTask", () => {
	it("uses provided title", () => {
		const task = parseTask("task/test.md", {}, "My Task");
		expect(task.title).toBe("My Task");
	});

	it("uses default status when not in frontmatter", () => {
		const task = parseTask("task/test.md", {}, "Task");
		expect(task.status).toBe("inbox");
	});

	it("reads status from frontmatter", () => {
		const task = parseTask("task/test.md", { status: "active" }, "Task");
		expect(task.status).toBe("active");
	});

	it("reads priority from frontmatter", () => {
		const task = parseTask("task/test.md", { priority: "high" }, "Task");
		expect(task.priority).toBe("high");
	});

	it("defaults priority to normal", () => {
		const task = parseTask("task/test.md", {}, "Task");
		expect(task.priority).toBe("normal");
	});

	it("parses projects array", () => {
		const task = parseTask("task/test.md", { projects: ["[[ProjA]]", "[[ProjB]]"] }, "Task");
		expect(task.projects).toEqual(["[[ProjA]]", "[[ProjB]]"]);
	});

	it("parses projects from comma-separated string", () => {
		const task = parseTask("task/test.md", { projects: "ProjA, ProjB" }, "Task");
		expect(task.projects).toEqual(["ProjA", "ProjB"]);
	});

	it("returns empty projects when missing", () => {
		const task = parseTask("task/test.md", {}, "Task");
		expect(task.projects).toEqual([]);
	});

	it("parses start date", () => {
		const task = parseTask("task/test.md", { start: "2026-03-25T15:00:00+02:00" }, "Task");
		expect(task.start).toBe("2026-03-25T15:00:00+02:00");
	});

	it("parses end date", () => {
		const task = parseTask("task/test.md", { end: "2026-03-25T15:30:00+02:00" }, "Task");
		expect(task.end).toBe("2026-03-25T15:30:00+02:00");
	});

	it("returns null start/end when missing", () => {
		const task = parseTask("task/test.md", {}, "Task");
		expect(task.start).toBeNull();
		expect(task.end).toBeNull();
	});

	it("parses recurrence", () => {
		const task = parseTask("task/test.md", { recurrence: "FREQ=WEEKLY;BYDAY=MO" }, "Task");
		expect(task.recurrence).toBe("FREQ=WEEKLY;BYDAY=MO");
	});

	it("parses tags array", () => {
		const task = parseTask("task/test.md", { tags: ["urgent", "work"] }, "Task");
		expect(task.tags).toEqual(["urgent", "work"]);
	});

	it("stores file path", () => {
		const task = parseTask("task/my_task.md", {}, "Task");
		expect(task.filePath).toBe("task/my_task.md");
	});

	it("body defaults to empty string", () => {
		const task = parseTask("task/test.md", {}, "Task");
		expect(task.body).toBe("");
	});

	// --- Parent field ---

	it("parses parent from frontmatter", () => {
		const task = parseTask("task/test.md", { parent: "[[Build website]]" }, "Task");
		expect(task.parent).toBe("[[Build website]]");
	});

	it("returns null parent when missing", () => {
		const task = parseTask("task/test.md", {}, "Task");
		expect(task.parent).toBeNull();
	});
});
