import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runTypeSafety } from "./type-safety.js";

function makeProject(files: Record<string, string>): string {
	const dir = mkdtempSync(join(tmpdir(), "vcqa-tsafe-"));
	writeFileSync(join(dir, "package.json"), "{}");
	mkdirSync(join(dir, "src"), { recursive: true });
	for (const [name, content] of Object.entries(files)) {
		const full = join(dir, "src", name);
		mkdirSync(join(full, ".."), { recursive: true });
		writeFileSync(full, content);
	}
	return dir;
}

describe("runTypeSafety", () => {
	it("skips when no source files", () => {
		const dir = mkdtempSync(join(tmpdir(), "vcqa-tsafe-"));
		writeFileSync(join(dir, "package.json"), "{}");
		const r = runTypeSafety(dir);
		expect(r.score).toBe(100);
		expect((r.details as any).skipped).toBe(true);
		rmSync(dir, { recursive: true });
	});

	it("detects 'as any' casts", () => {
		const dir = makeProject({ "app.ts": "const x = foo as any;" });
		const r = runTypeSafety(dir);
		expect(r.issues.some((i) => i.message === "as any")).toBe(true);
		expect(r.score).toBeLessThan(100);
		rmSync(dir, { recursive: true });
	});

	it("detects ': any' annotations", () => {
		const dir = makeProject({ "app.ts": "function f(x: any) { return x; }" });
		const r = runTypeSafety(dir);
		expect(r.issues.some((i) => i.message === ": any")).toBe(true);
		rmSync(dir, { recursive: true });
	});

	it("detects @ts-ignore", () => {
		const dir = makeProject({ "app.ts": "// @ts-ignore\nconst x: number = 'hello';" });
		const r = runTypeSafety(dir);
		expect(r.issues.some((i) => i.message === "@ts-ignore")).toBe(true);
		rmSync(dir, { recursive: true });
	});

	it("penalizes @ts-nocheck heavily", () => {
		const dir = makeProject({ "app.ts": "// @ts-nocheck\nconst x = 1;" });
		const r = runTypeSafety(dir);
		expect(r.issues.some((i) => i.message === "@ts-nocheck")).toBe(true);
		expect(r.score).toBeLessThanOrEqual(90);
		rmSync(dir, { recursive: true });
	});

	it("detects non-null assertions", () => {
		const dir = makeProject({ "app.ts": "const x = obj!.value;" });
		const r = runTypeSafety(dir);
		expect(r.issues.some((i) => i.message === "non-null assertion (!.)")).toBe(true);
		rmSync(dir, { recursive: true });
	});

	it("scores 100 for clean TypeScript", () => {
		const dir = makeProject({ "app.ts": "export function add(a: number, b: number): number { return a + b; }" });
		const r = runTypeSafety(dir);
		expect(r.score).toBe(100);
		expect(r.issues).toHaveLength(0);
		rmSync(dir, { recursive: true });
	});
});
