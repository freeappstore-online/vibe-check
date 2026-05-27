import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runDuplication } from "./duplication.js";

function makeProject(files: Record<string, string>): string {
	const dir = mkdtempSync(join(tmpdir(), "vcqa-dup-"));
	writeFileSync(join(dir, "package.json"), "{}");
	mkdirSync(join(dir, "src"), { recursive: true });
	for (const [name, content] of Object.entries(files)) {
		const full = join(dir, "src", name);
		mkdirSync(join(full, ".."), { recursive: true });
		writeFileSync(full, content);
	}
	return dir;
}

describe("runDuplication", () => {
	it("returns score 100 with fewer than 2 files", () => {
		const dir = makeProject({ "app.ts": "export const x = 1;" });
		const r = runDuplication(dir);
		expect(r.score).toBe(100);
		expect((r.details as any).duplicates).toBe(0);
		rmSync(dir, { recursive: true });
	});

	it("detects duplicate blocks across files", () => {
		const block = [
			"function validate(input: string): boolean {",
			"  if (!input) return false;",
			"  if (input.length < 3) return false;",
			"  if (input.length > 100) return false;",
			"  const trimmed = input.trim();",
			"  return trimmed.length > 0;",
			"}",
		].join("\n");
		const dir = makeProject({
			"a.ts": block,
			"b.ts": block,
		});
		const r = runDuplication(dir);
		expect(r.issues.some((i) => i.rule === "duplicate-code")).toBe(true);
		rmSync(dir, { recursive: true });
	});

	it("does not flag short/trivial blocks", () => {
		const dir = makeProject({
			"a.ts": "export const x = 1;\nexport const y = 2;",
			"b.ts": "export const x = 1;\nexport const y = 2;",
		});
		const r = runDuplication(dir);
		expect(r.issues).toHaveLength(0);
		rmSync(dir, { recursive: true });
	});

	it("emits issues for both files in a duplicate pair", () => {
		const block = [
			"function validate(input: string): boolean {",
			"  if (!input) return false;",
			"  if (input.length < 3) return false;",
			"  if (input.length > 100) return false;",
			"  const trimmed = input.trim();",
			"  return trimmed.length > 0;",
			"}",
		].join("\n");
		const dir = makeProject({
			"a.ts": block,
			"b.ts": block,
		});
		const r = runDuplication(dir);
		const fileRefs = r.issues.map((i) => i.file);
		expect(fileRefs.some((f) => f?.includes("a.ts"))).toBe(true);
		expect(fileRefs.some((f) => f?.includes("b.ts"))).toBe(true);
		expect(r.issues.every((i) => i.line !== undefined)).toBe(true);
		rmSync(dir, { recursive: true });
	});

	it("scores 100 for unique code", () => {
		const dir = makeProject({
			"a.ts": "export function greet(name: string) { return `Hello ${name}`; }",
			"b.ts": "export function farewell(name: string) { return `Goodbye ${name}`; }",
		});
		const r = runDuplication(dir);
		expect(r.score).toBe(100);
		rmSync(dir, { recursive: true });
	});
});
