import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { StackInfo } from "../types.js";
import { runStandards } from "./standards.js";

const tsStack: StackInfo = {
	language: "typescript",
	framework: "react",
	bundler: "vite",
	testRunner: "vitest",
	linter: "biome",
	packageManager: "pnpm",
};

function makeProject(files: Record<string, string>, rootFiles?: Record<string, string>): string {
	const dir = mkdtempSync(join(tmpdir(), "vcqa-std-"));
	writeFileSync(join(dir, "package.json"), "{}");
	mkdirSync(join(dir, "src"), { recursive: true });
	for (const [name, content] of Object.entries(files)) {
		const full = join(dir, "src", name);
		mkdirSync(join(full, ".."), { recursive: true });
		writeFileSync(full, content);
	}
	if (rootFiles) {
		for (const [name, content] of Object.entries(rootFiles)) {
			writeFileSync(join(dir, name), content);
		}
	}
	return dir;
}

describe("runStandards", () => {
	it("detects console.log", () => {
		const dir = makeProject({ "app.ts": 'console.log("debug");' });
		const r = runStandards(dir, tsStack);
		expect(r.issues.some((i) => i.rule === "console.log")).toBe(true);
		rmSync(dir, { recursive: true });
	});

	it("detects var keyword", () => {
		const dir = makeProject({ "app.ts": "var x = 1;" });
		const r = runStandards(dir, tsStack);
		expect(r.issues.some((i) => i.rule === "var keyword")).toBe(true);
		rmSync(dir, { recursive: true });
	});

	it("detects loose equality", () => {
		const dir = makeProject({ "app.ts": "if (a == b) {}" });
		const r = runStandards(dir, tsStack);
		expect(r.issues.some((i) => i.rule === "loose equality")).toBe(true);
		rmSync(dir, { recursive: true });
	});

	it("flags large files over 300 lines", () => {
		const lines = Array.from({ length: 310 }, (_, i) => `const x${i} = ${i};`).join("\n");
		const dir = makeProject({ "big.ts": lines });
		const r = runStandards(dir, tsStack);
		expect(r.issues.some((i) => i.rule === "large-file" && i.message.includes("310"))).toBe(true);
		rmSync(dir, { recursive: true });
	});

	it("flags missing strict mode in tsconfig", () => {
		const dir = makeProject({ "app.ts": "export const x = 1;" }, { "tsconfig.json": '{ "compilerOptions": {} }' });
		const r = runStandards(dir, tsStack);
		expect(r.issues.some((i) => i.rule === "ts-strict")).toBe(true);
		rmSync(dir, { recursive: true });
	});

	it("passes strict mode when tsconfig has strict: true", () => {
		const dir = makeProject({ "app.ts": "export const x = 1;" }, { "tsconfig.json": '{ "compilerOptions": { "strict": true } }' });
		const r = runStandards(dir, tsStack);
		expect(r.issues.some((i) => i.rule === "ts-strict")).toBe(false);
		rmSync(dir, { recursive: true });
	});

	it("detects TODO/FIXME comments", () => {
		const dir = makeProject({ "app.ts": "const x = 1; // TODO fix this later" });
		const r = runStandards(dir, tsStack);
		expect(r.issues.some((i) => i.rule === "TODO/FIXME")).toBe(true);
		rmSync(dir, { recursive: true });
	});

	it("respects console.log exclude pattern (// ok)", () => {
		const dir = makeProject({ "app.ts": 'console.log("intentional"); // ok' });
		const r = runStandards(dir, tsStack);
		expect(r.issues.some((i) => i.rule === "console.log")).toBe(false);
		rmSync(dir, { recursive: true });
	});

	it("skips console.log in CLI files", () => {
		const dir = makeProject({ "cli.ts": 'console.log("output");' });
		const r = runStandards(dir, tsStack);
		expect(r.issues.some((i) => i.rule === "console.log")).toBe(false);
		rmSync(dir, { recursive: true });
	});

	it("does not false-positive on == inside string literals", () => {
		const dir = makeProject(
			{ "app.ts": 'const query = "WHERE status==active";' },
			{ "tsconfig.json": '{ "compilerOptions": { "strict": true } }' },
		);
		const r = runStandards(dir, tsStack);
		expect(r.issues.some((i) => i.rule === "loose equality")).toBe(false);
		rmSync(dir, { recursive: true });
	});

	it("detects http:// URLs", () => {
		const dir = makeProject(
			{ "app.ts": 'const url = "http://example.com/api";' },
			{ "tsconfig.json": '{ "compilerOptions": { "strict": true } }' },
		);
		const r = runStandards(dir, tsStack);
		expect(r.issues.some((i) => i.rule === "http:// URL")).toBe(true);
		rmSync(dir, { recursive: true });
	});

	it("allows http://localhost", () => {
		const dir = makeProject(
			{ "app.ts": 'const url = "http://localhost:3000";' },
			{ "tsconfig.json": '{ "compilerOptions": { "strict": true } }' },
		);
		const r = runStandards(dir, tsStack);
		expect(r.issues.some((i) => i.rule === "http:// URL")).toBe(false);
		rmSync(dir, { recursive: true });
	});

	it("scores 100 for clean code", () => {
		const dir = makeProject(
			{ "app.ts": 'export const greeting = "hello";' },
			{ "tsconfig.json": '{ "compilerOptions": { "strict": true } }' },
		);
		const r = runStandards(dir, tsStack);
		expect(r.score).toBe(100);
		rmSync(dir, { recursive: true });
	});
});
