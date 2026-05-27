import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runConfusion } from "./confusion.js";

function makeProject(files: Record<string, string>): string {
	const dir = mkdtempSync(join(tmpdir(), "vcqa-conf-"));
	writeFileSync(join(dir, "package.json"), "{}");
	mkdirSync(join(dir, "src"), { recursive: true });
	for (const [name, content] of Object.entries(files)) {
		const full = join(dir, "src", name);
		mkdirSync(join(full, ".."), { recursive: true });
		writeFileSync(full, content);
	}
	return dir;
}

describe("runConfusion", () => {
	it("skips when no source files", () => {
		const dir = mkdtempSync(join(tmpdir(), "vcqa-conf-"));
		writeFileSync(join(dir, "package.json"), "{}");
		const r = runConfusion(dir);
		expect(r.score).toBe(100);
		expect((r.details as any).skipped).toBe(true);
		rmSync(dir, { recursive: true });
	});

	it("detects similar filenames (low edit distance)", () => {
		const dir = makeProject({
			"user.ts": "export const x = 1;",
			"users.ts": "export const y = 2;",
		});
		const r = runConfusion(dir);
		expect(r.issues.some((i) => i.rule === "similar-filename")).toBe(true);
		rmSync(dir, { recursive: true });
	});

	it("detects synonym filenames (utils/helpers)", () => {
		const dir = makeProject({
			"utils.ts": "export const x = 1;",
			"helpers.ts": "export const y = 2;",
		});
		const r = runConfusion(dir);
		expect(r.issues.some((i) => i.rule === "synonym-filename")).toBe(true);
		rmSync(dir, { recursive: true });
	});

	it("detects generic export names", () => {
		const dir = makeProject({
			"app.ts": "export function process() { return 1; }",
		});
		const r = runConfusion(dir);
		expect(r.issues.some((i) => i.rule === "generic-name")).toBe(true);
		rmSync(dir, { recursive: true });
	});

	it("detects export name collisions across files", () => {
		const dir = makeProject({
			"a.ts": "export function validate() { return true; }",
			"b.ts": "export function validate() { return false; }",
		});
		const r = runConfusion(dir);
		expect(r.issues.some((i) => i.rule === "export-collision")).toBe(true);
		rmSync(dir, { recursive: true });
	});

	it("detects ambiguous abbreviations in filenames", () => {
		const dir = makeProject({
			"auth.ts": "export const login = () => {};",
		});
		const r = runConfusion(dir);
		expect(r.issues.some((i) => i.rule === "ambiguous-abbreviation")).toBe(true);
		rmSync(dir, { recursive: true });
	});

	it("scores 100 for unique, descriptive names", () => {
		const dir = makeProject({
			"authentication.ts": "export function authenticateUser() { return true; }",
			"validation.ts": "export function validateEmail(email: string) { return email.includes('@'); }",
		});
		const r = runConfusion(dir);
		expect(r.score).toBe(100);
		rmSync(dir, { recursive: true });
	});
});
