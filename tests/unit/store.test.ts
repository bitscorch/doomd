import { describe, it, expect, vi, beforeEach } from "vitest";
import { TaskStore } from "../../src/store";
import { TFile } from "obsidian";

function createMockApp() {
	const fm: Record<string, unknown> = {
		status: "inbox",
		priority: "normal",
		dateCreated: "2026-01-01T00:00:00.000Z",
		dateModified: "2026-01-01T00:00:00.000Z",
	};

	const mockFile = new TFile();
	Object.assign(mockFile, { path: "task/test.md", extension: "md", basename: "test" });

	return {
		fm,
		mockFile,
		vault: {
			getAbstractFileByPath: vi.fn().mockReturnValue(mockFile),
		},
		metadataCache: {
			getFileCache: vi.fn().mockReturnValue({
				frontmatter: fm,
				headings: [{ level: 1, heading: "Test Task" }],
			}),
			getCache: vi.fn().mockReturnValue({ frontmatter: fm }),
		},
		fileManager: {
			processFrontMatter: vi.fn(async (_file: unknown, cb: (fm: Record<string, unknown>) => void) => {
				cb(fm);
			}),
		},
	};
}

describe("TaskStore.updateTaskField", () => {
	let store: TaskStore;
	let app: ReturnType<typeof createMockApp>;

	beforeEach(() => {
		app = createMockApp();
		store = new TaskStore(app as any, "task");
	});

	it("updates the specified field", async () => {
		await store.updateTaskField("task/test.md", "status", "done");
		expect(app.fm.status).toBe("done");
	});

	it("sets dateModified to current ISO timestamp", async () => {
		const before = new Date().toISOString();
		await store.updateTaskField("task/test.md", "status", "done");
		const after = new Date().toISOString();

		const modified = app.fm.dateModified as string;
		expect(modified >= before).toBe(true);
		expect(modified <= after).toBe(true);
	});

	it("sets dateModified even when updating non-status fields", async () => {
		await store.updateTaskField("task/test.md", "priority", "high");
		expect(app.fm.priority).toBe("high");
		expect(app.fm.dateModified).not.toBe("2026-01-01T00:00:00.000Z");
	});

	it("does nothing if file not found", async () => {
		app.vault.getAbstractFileByPath.mockReturnValue(null);
		await store.updateTaskField("task/nonexistent.md", "status", "done");
		expect(app.fileManager.processFrontMatter).not.toHaveBeenCalled();
	});
});
