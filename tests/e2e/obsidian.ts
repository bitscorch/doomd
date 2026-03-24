import { Page, chromium, Browser } from "@playwright/test";
import { spawn, execSync, ChildProcess } from "child_process";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PLUGIN_DIR = path.resolve(__dirname, "../..");
const E2E_VAULT_DIR = path.join(PLUGIN_DIR, "e2e-vault");
const E2E_CONFIG_DIR = path.join(PLUGIN_DIR, ".obsidian-config-e2e");
const UNPACKED_DIR = path.join(PLUGIN_DIR, ".obsidian-unpacked");
const OBSIDIAN_APPIMAGE = process.env.OBSIDIAN_APPIMAGE || path.join(process.env.HOME || "", "apps/Obsidian-1.12.7.AppImage");
const OBSIDIAN_DATA_DIR = path.join(process.env.HOME || "", ".config/obsidian");

export interface ObsidianApp {
	browser?: Browser;
	process?: ChildProcess;
	page: Page;
}

function ensureE2EVault(): void {
	if (!fs.existsSync(E2E_VAULT_DIR)) {
		fs.mkdirSync(E2E_VAULT_DIR, { recursive: true });
	}

	const obsidianDir = path.join(E2E_VAULT_DIR, ".obsidian");
	if (!fs.existsSync(obsidianDir)) {
		fs.mkdirSync(obsidianDir, { recursive: true });
	}

	fs.writeFileSync(
		path.join(obsidianDir, "community-plugins.json"),
		JSON.stringify(["doomd"])
	);

	// Create folders
	for (const dir of ["task", "proj"]) {
		const p = path.join(E2E_VAULT_DIR, dir);
		if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
	}

	// Symlink plugin
	const pluginDir = path.join(obsidianDir, "plugins", "doomd");
	if (!fs.existsSync(path.join(obsidianDir, "plugins"))) {
		fs.mkdirSync(path.join(obsidianDir, "plugins"), { recursive: true });
	}
	// Remove existing symlink/dir
	if (fs.existsSync(pluginDir)) {
		fs.rmSync(pluginDir, { recursive: true, force: true });
	}
	fs.symlinkSync(PLUGIN_DIR, pluginDir);
}

function ensureUnpacked(): void {
	const obsidianBinary = path.join(UNPACKED_DIR, "obsidian");
	if (fs.existsSync(obsidianBinary)) return; // Already unpacked

	if (!fs.existsSync(OBSIDIAN_APPIMAGE)) {
		throw new Error(`Obsidian AppImage not found at: ${OBSIDIAN_APPIMAGE}`);
	}

	// Find obsidian.asar
	const asarFiles = fs.readdirSync(OBSIDIAN_DATA_DIR).filter((f) => f.match(/^obsidian-.*\.asar$/));
	if (asarFiles.length === 0) {
		throw new Error(`No obsidian.asar found in ${OBSIDIAN_DATA_DIR}`);
	}
	const obsidianAsar = path.join(OBSIDIAN_DATA_DIR, asarFiles.sort().reverse()[0]!);

	console.log(`Extracting AppImage...`);
	execSync(`cd /tmp && "${OBSIDIAN_APPIMAGE}" --appimage-extract > /dev/null 2>&1`);

	// Set up unpacked dir (cp instead of rename to handle cross-device)
	if (fs.existsSync(UNPACKED_DIR)) fs.rmSync(UNPACKED_DIR, { recursive: true, force: true });
	execSync(`cp -r /tmp/squashfs-root "${UNPACKED_DIR}"`);
	fs.rmSync("/tmp/squashfs-root", { recursive: true, force: true });

	// Unpack asar
	console.log(`Unpacking asar...`);
	execSync(`npx @electron/asar extract "${obsidianAsar}" "${path.join(UNPACKED_DIR, "resources/app")}"`, {
		stdio: "pipe",
	});
}

export async function launchObsidian(): Promise<ObsidianApp> {
	ensureE2EVault();
	ensureUnpacked();

	const obsidianBinary = path.join(UNPACKED_DIR, "obsidian");
	const remoteDebuggingPort = 9223;

	// Set up vault registry for the e2e config
	if (!fs.existsSync(E2E_CONFIG_DIR)) {
		fs.mkdirSync(E2E_CONFIG_DIR, { recursive: true });
	}
	fs.writeFileSync(
		path.join(E2E_CONFIG_DIR, "obsidian.json"),
		JSON.stringify({ vaults: { "e2e-test": { path: E2E_VAULT_DIR, ts: Date.now(), open: true } } })
	);

	const obsidianProcess = spawn(obsidianBinary, [
		"--no-sandbox",
		`--remote-debugging-port=${remoteDebuggingPort}`,
		`--user-data-dir=${E2E_CONFIG_DIR}`,
	], {
		cwd: UNPACKED_DIR,
		stdio: ["ignore", "pipe", "pipe"],
		env: {
			...process.env,
			OBSIDIAN_CONFIG_DIR: E2E_CONFIG_DIR,
		},
	});

	const cdpUrl = await waitForCdp(remoteDebuggingPort, obsidianProcess, 60000);
	console.log("Connecting to CDP:", cdpUrl);

	const browser = await chromium.connectOverCDP(cdpUrl);

	// Get the page
	let page: Page;
	let contexts = browser.contexts();
	if (contexts.length === 0) {
		await new Promise<void>((resolve) => {
			const check = () => {
				contexts = browser.contexts();
				if (contexts.length > 0) resolve();
				else setTimeout(check, 100);
			};
			check();
		});
	}
	const context = contexts[0]!;
	page = context.pages().length > 0 ? context.pages()[0]! : await context.waitForEvent("page");

	await page.waitForLoadState("domcontentloaded");
	await page.waitForTimeout(3000);

	// Handle trust dialog
	for (const text of [
		"Trust author and enable plugins",
		"Trust",
		"Turn on community plugins",
		"Enable community plugins",
	]) {
		const btn = page.locator(`button:has-text("${text}")`);
		if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
			await btn.click();
			await page.waitForTimeout(1500);
		}
	}

	await page.waitForSelector(".workspace", { timeout: 30000 });
	await page.waitForTimeout(2000);

	// Close any open modals
	for (let i = 0; i < 3; i++) {
		await page.keyboard.press("Escape");
		await page.waitForTimeout(200);
	}

	return { browser, process: obsidianProcess, page };
}

export async function closeObsidian(app: ObsidianApp | undefined): Promise<void> {
	if (!app) return;
	if (app.browser) {
		await app.browser.close().catch(() => {});
	}
	if (app.process) {
		app.process.kill();
	}
	// Clean up task files
	const taskDir = path.join(E2E_VAULT_DIR, "task");
	if (fs.existsSync(taskDir)) {
		for (const file of fs.readdirSync(taskDir)) {
			if (file.endsWith(".md")) {
				fs.unlinkSync(path.join(taskDir, file));
			}
		}
	}
}

export async function runCommand(page: Page, command: string): Promise<void> {
	await page.keyboard.press("Escape");
	await page.waitForTimeout(200);

	const workspace = page.locator(".workspace");
	if (await workspace.isVisible({ timeout: 1000 }).catch(() => false)) {
		await workspace.click({ position: { x: 100, y: 100 } }).catch(() => {});
		await page.waitForTimeout(100);
	}

	await page.keyboard.press("Control+p");
	await page.waitForSelector(".prompt", { timeout: 5000 });

	const promptInput = page.locator(".prompt-input");
	await promptInput.fill("");
	await page.keyboard.type(command, { delay: 30 });
	await page.waitForTimeout(500);

	const suggestion = page.locator(".suggestion-item").first();
	await suggestion.waitFor({ timeout: 3000, state: "visible" });
	await page.keyboard.press("Enter");
}

async function waitForCdp(port: number, proc: ChildProcess, timeoutMs: number): Promise<string> {
	return new Promise((resolve, reject) => {
		const timeout = setTimeout(() => {
			reject(new Error("Timeout waiting for CDP"));
		}, timeoutMs);

		const poll = setInterval(async () => {
			try {
				const http = await import("http");
				const url = await new Promise<string | null>((res) => {
					const req = http.get(`http://localhost:${port}/json/version`, (response) => {
						let data = "";
						response.on("data", (chunk: string) => { data += chunk; });
						response.on("end", () => {
							try {
								res(JSON.parse(data).webSocketDebuggerUrl || null);
							} catch {
								res(null);
							}
						});
					});
					req.on("error", () => res(null));
					req.setTimeout(1000, () => { req.destroy(); res(null); });
				});
				if (url) {
					clearTimeout(timeout);
					clearInterval(poll);
					resolve(url);
				}
			} catch {
				// keep polling
			}
		}, 500);

		proc.on("exit", () => {
			clearTimeout(timeout);
			clearInterval(poll);
			reject(new Error("Obsidian exited before CDP was ready"));
		});
	});
}
