import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { StackInfo } from "../types.js";
import { runStructure } from "./structure.js";

const tsStack: StackInfo = {
	language: "typescript",
	framework: "react",
	bundler: "vite",
	testRunner: "vitest",
	linter: "biome",
	packageManager: "pnpm",
};

function makeProject(opts: { files?: Record<string, string>; srcFiles?: Record<string, string> }): string {
	const dir = mkdtempSync(join(tmpdir(), "vcqa-struct-"));
	if (opts.files) {
		for (const [name, content] of Object.entries(opts.files)) {
			const full = join(dir, name);
			mkdirSync(join(full, ".."), { recursive: true });
			writeFileSync(full, content);
		}
	}
	if (opts.srcFiles) {
		mkdirSync(join(dir, "src"), { recursive: true });
		for (const [name, content] of Object.entries(opts.srcFiles)) {
			writeFileSync(join(dir, "src", name), content);
		}
	}
	return dir;
}

describe("runStructure", () => {
	it("flags missing package.json", () => {
		const dir = mkdtempSync(join(tmpdir(), "vcqa-struct-"));
		mkdirSync(join(dir, "src"), { recursive: true });
		writeFileSync(join(dir, "src", "app.ts"), "export const x = 1;");
		const r = runStructure(dir, tsStack);
		expect(r.issues.some((i) => i.message.includes("package.json"))).toBe(true);
		rmSync(dir, { recursive: true });
	});

	it("flags missing LICENSE", () => {
		const dir = makeProject({
			files: { "package.json": "{}", ".gitignore": "node_modules", "tsconfig.json": "{}" },
			srcFiles: { "app.ts": "export const x = 1;" },
		});
		const r = runStructure(dir, tsStack);
		expect(r.issues.some((i) => i.message.includes("LICENSE"))).toBe(true);
		rmSync(dir, { recursive: true });
	});

	it("flags missing lockfile", () => {
		const dir = makeProject({
			files: { "package.json": "{}", ".gitignore": "node_modules", LICENSE: "MIT" },
			srcFiles: { "app.ts": "export const x = 1;" },
		});
		const r = runStructure(dir, tsStack);
		expect(r.issues.some((i) => i.rule === "missing-lockfile")).toBe(true);
		rmSync(dir, { recursive: true });
	});

	it("flags no src directory", () => {
		const dir = makeProject({ files: { "package.json": "{}" } });
		const r = runStructure(dir, tsStack);
		expect(r.issues.some((i) => i.rule === "no-src")).toBe(true);
		rmSync(dir, { recursive: true });
	});

	it("flags zero test files", () => {
		const dir = makeProject({
			files: { "package.json": "{}" },
			srcFiles: { "app.ts": "export const x = 1;", "util.ts": "export const y = 2;" },
		});
		const r = runStructure(dir, tsStack);
		expect(r.issues.some((i) => i.rule === "no-tests")).toBe(true);
		rmSync(dir, { recursive: true });
	});

	it("flags missing test script in package.json", () => {
		const dir = makeProject({
			files: { "package.json": '{ "scripts": {} }', ".gitignore": "node_modules", LICENSE: "MIT", "pnpm-lock.yaml": "" },
			srcFiles: { "app.ts": "export const x = 1;", "app.test.ts": "test('x', () => {})" },
		});
		const r = runStructure(dir, tsStack);
		expect(r.issues.some((i) => i.rule === "no-test-script")).toBe(true);
		rmSync(dir, { recursive: true });
	});

	it("scores high for a well-structured project", () => {
		const dir = makeProject({
			files: {
				"package.json": '{ "scripts": { "test": "vitest", "build": "tsc" } }',
				"tsconfig.json": "{}",
				LICENSE: "MIT",
				".gitignore": "node_modules",
				"README.md": "# App",
				"pnpm-lock.yaml": "",
			},
			srcFiles: {
				"app.ts": "export const x = 1;",
				"app.test.ts": "import { x } from './app'; test('x', () => expect(x).toBe(1));",
			},
		});
		const r = runStructure(dir, tsStack);
		expect(r.score).toBeGreaterThanOrEqual(90);
		rmSync(dir, { recursive: true });
	});
});
