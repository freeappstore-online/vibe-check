import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runDocs } from "./docs.js";

function makeProject(opts: { readme?: string; srcFiles?: Record<string, string> }): string {
	const dir = mkdtempSync(join(tmpdir(), "vcqa-docs-"));
	writeFileSync(join(dir, "package.json"), "{}");
	if (opts.readme !== undefined) {
		writeFileSync(join(dir, "README.md"), opts.readme);
	}
	if (opts.srcFiles) {
		mkdirSync(join(dir, "src"), { recursive: true });
		for (const [name, content] of Object.entries(opts.srcFiles)) {
			const full = join(dir, "src", name);
			mkdirSync(join(full, ".."), { recursive: true });
			writeFileSync(full, content);
		}
	}
	return dir;
}

describe("runDocs", () => {
	it("flags missing README", () => {
		const dir = makeProject({ srcFiles: { "app.ts": "export const x = 1;" } });
		const r = runDocs(dir);
		expect(r.issues.some((i) => i.rule === "no-readme")).toBe(true);
		rmSync(dir, { recursive: true });
	});

	it("flags short README", () => {
		const dir = makeProject({ readme: "# App\nHello.", srcFiles: { "app.ts": "export const x = 1;" } });
		const r = runDocs(dir);
		expect(r.issues.some((i) => i.rule === "short-readme")).toBe(true);
		rmSync(dir, { recursive: true });
	});

	it("gives full README score for long README", () => {
		const readme = Array.from({ length: 25 }, (_, i) => `Line ${i}: description of feature.`).join("\n");
		const dir = makeProject({ readme, srcFiles: { "app.ts": "export const x = 1;" } });
		const r = runDocs(dir);
		expect(r.issues.some((i) => i.rule === "short-readme")).toBe(false);
		expect(r.issues.some((i) => i.rule === "no-readme")).toBe(false);
		rmSync(dir, { recursive: true });
	});

	it("flags undocumented exports", () => {
		const code = [
			"export function doSomething() { return 1; }",
			"export function doAnother() { return 2; }",
			"export class MyService {}",
		].join("\n");
		const readme = Array.from({ length: 25 }, (_, i) => `Line ${i}`).join("\n");
		const dir = makeProject({ readme, srcFiles: { "app.ts": code } });
		const r = runDocs(dir);
		expect(r.issues.some((i) => i.rule === "undocumented-exports")).toBe(true);
		rmSync(dir, { recursive: true });
	});

	it("counts export const and export type as exports", () => {
		const code = ["export const MAX_RETRIES = 3;", "export type Config = { url: string };", "export function init() {}"].join("\n");
		const readme = Array.from({ length: 25 }, (_, i) => `Line ${i}`).join("\n");
		const dir = makeProject({ readme, srcFiles: { "app.ts": code } });
		const r = runDocs(dir);
		expect((r.details as any).totalExports).toBe(3);
		rmSync(dir, { recursive: true });
	});

	it("gives credit for JSDoc-documented exports", () => {
		const code = ["/** Greets a user. */", "export function greet(name: string) { return `Hi ${name}`; }"].join("\n");
		const readme = Array.from({ length: 25 }, (_, i) => `Line ${i}`).join("\n");
		const dir = makeProject({ readme, srcFiles: { "app.ts": code } });
		const r = runDocs(dir);
		expect(r.issues.some((i) => i.rule === "undocumented-exports")).toBe(false);
		expect(r.score).toBeGreaterThanOrEqual(90);
		rmSync(dir, { recursive: true });
	});

	it("scores 100 with good README and no exports", () => {
		const readme = "# App\n\n## Install\n\n```sh\npnpm install\n```\n\n" + Array.from({ length: 20 }, () => "desc").join("\n");
		const dir = makeProject({ readme, srcFiles: { "app.ts": "const x = 1;" } });
		const r = runDocs(dir);
		expect(r.score).toBe(100);
		rmSync(dir, { recursive: true });
	});
});
