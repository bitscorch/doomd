import { test, expect } from "@playwright/test";
import { launchObsidian, closeObsidian, runCommand, ObsidianApp } from "./obsidian";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const E2E_VAULT_DIR = path.resolve(__dirname, "../../e2e-vault");
const TASK_DIR = path.join(E2E_VAULT_DIR, "task");

let app: ObsidianApp;

test.beforeAll(async () => {
	app = await launchObsidian();
});

test.afterAll(async () => {
	await closeObsidian(app);
});

test.describe("task creation", () => {
	test("creates a task file via command palette", async () => {
		const { page } = app;

		// Open create task modal
		await runCommand(page, "doomd: Create task");
		await page.waitForTimeout(500);

		// Type task title in the embedded editor
		await page.keyboard.type("Test task from e2e", { delay: 20 });
		await page.waitForTimeout(200);

		// Submit with Cmd+Enter
		await page.keyboard.press("Control+Enter");
		await page.waitForTimeout(1000);

		// Verify task file was created
		const files = fs.readdirSync(TASK_DIR).filter((f) => f.endsWith(".md"));
		const taskFile = files.find((f) => f.includes("Test task from e2e"));
		expect(taskFile).toBeDefined();

		// Read and verify content
		const content = fs.readFileSync(path.join(TASK_DIR, taskFile!), "utf-8");
		expect(content).toContain("status: inbox");
		expect(content).toContain("priority: normal");
		expect(content).toContain("# Test task from e2e");
	});

	test("creates a task with project", async () => {
		const { page } = app;

		await runCommand(page, "doomd: Create task");
		await page.waitForTimeout(500);

		await page.keyboard.type("Fix bug +[[TestProject]]", { delay: 20 });
		await page.waitForTimeout(200);
		await page.keyboard.press("Control+Enter");
		await page.waitForTimeout(1000);

		const files = fs.readdirSync(TASK_DIR).filter((f) => f.endsWith(".md"));
		const taskFile = files.find((f) => f.includes("Fix bug"));
		expect(taskFile).toBeDefined();

		const content = fs.readFileSync(path.join(TASK_DIR, taskFile!), "utf-8");
		expect(content).toContain("[[TestProject]]");
		expect(content).toContain("# Fix bug +[[TestProject]]");
	});

	test("creates a task with tags and contexts", async () => {
		const { page } = app;

		await runCommand(page, "doomd: Create task");
		await page.waitForTimeout(500);

		await page.keyboard.type("Buy groceries @home #errands", { delay: 20 });
		await page.waitForTimeout(200);
		await page.keyboard.press("Control+Enter");
		await page.waitForTimeout(1000);

		const files = fs.readdirSync(TASK_DIR).filter((f) => f.endsWith(".md"));
		const taskFile = files.find((f) => f.includes("Buy groceries"));
		expect(taskFile).toBeDefined();

		const content = fs.readFileSync(path.join(TASK_DIR, taskFile!), "utf-8");
		expect(content).toContain("  - errands");
		expect(content).toContain("  - home");
	});

	test("creates a task with due date", async () => {
		const { page } = app;

		await runCommand(page, "doomd: Create task");
		await page.waitForTimeout(500);

		await page.keyboard.type("Meeting tomorrow at 3pm", { delay: 20 });
		await page.waitForTimeout(200);
		await page.keyboard.press("Control+Enter");
		await page.waitForTimeout(1000);

		const files = fs.readdirSync(TASK_DIR).filter((f) => f.endsWith(".md"));
		const taskFile = files.find((f) => f.includes("Meeting"));
		expect(taskFile).toBeDefined();

		const content = fs.readFileSync(path.join(TASK_DIR, taskFile!), "utf-8");
		expect(content).toMatch(/due: \d{4}-\d{2}-\d{2}T15:00:00/);
	});

	test("creates a task with all features combined", async () => {
		const { page } = app;

		await runCommand(page, "doomd: Create task");
		await page.waitForTimeout(500);

		await page.keyboard.type("Review docs tomorrow +[[PKM]] @work #urgent", { delay: 20 });
		await page.waitForTimeout(200);
		await page.keyboard.press("Control+Enter");
		await page.waitForTimeout(1000);

		const files = fs.readdirSync(TASK_DIR).filter((f) => f.endsWith(".md"));
		const taskFile = files.find((f) => f.includes("Review docs"));
		expect(taskFile).toBeDefined();

		const content = fs.readFileSync(path.join(TASK_DIR, taskFile!), "utf-8");
		expect(content).toContain("[[PKM]]");
		expect(content).toContain("  - urgent");
		expect(content).toContain("  - work");
		expect(content).toMatch(/due: \d{4}-\d{2}-\d{2}T/);
		expect(content).toContain("# Review docs tomorrow +[[PKM]] @work #urgent");
	});

	test("escape closes the modal without creating", async () => {
		const { page } = app;

		await runCommand(page, "doomd: Create task");
		await page.waitForTimeout(500);

		await page.keyboard.type("This should not be created", { delay: 20 });
		await page.keyboard.press("Escape");
		await page.waitForTimeout(500);

		const files = fs.readdirSync(TASK_DIR).filter((f) => f.endsWith(".md"));
		const taskFile = files.find((f) => f.includes("This should not be created"));
		expect(taskFile).toBeUndefined();
	});

	test("includes timezone in timestamps", async () => {
		const { page } = app;

		await runCommand(page, "doomd: Create task");
		await page.waitForTimeout(500);

		await page.keyboard.type("Timezone test", { delay: 20 });
		await page.keyboard.press("Control+Enter");
		await page.waitForTimeout(1000);

		const files = fs.readdirSync(TASK_DIR).filter((f) => f.endsWith(".md"));
		const taskFile = files.find((f) => f.includes("Timezone test"));
		expect(taskFile).toBeDefined();

		const content = fs.readFileSync(path.join(TASK_DIR, taskFile!), "utf-8");
		// Should have timezone offset like +02:00 or -05:00
		expect(content).toMatch(/dateCreated: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}/);
	});
});
