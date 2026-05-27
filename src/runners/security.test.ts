import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runSecurity } from "./security.js";

function makeProject(files: Record<string, string>, extra?: Record<string, string>): string {
	const dir = mkdtempSync(join(tmpdir(), "vcqa-sec-"));
	writeFileSync(join(dir, "package.json"), "{}");
	mkdirSync(join(dir, "src"), { recursive: true });
	for (const [name, content] of Object.entries(files)) {
		const full = join(dir, "src", name);
		mkdirSync(join(full, ".."), { recursive: true });
		writeFileSync(full, content);
	}
	if (extra) {
		for (const [name, content] of Object.entries(extra)) {
			writeFileSync(join(dir, name), content);
		}
	}
	return dir;
}

describe("runSecurity", () => {
	it("skips when no source files", () => {
		const dir = mkdtempSync(join(tmpdir(), "vcqa-sec-"));
		writeFileSync(join(dir, "package.json"), "{}");
		const r = runSecurity(dir);
		expect(r.score).toBe(100);
		expect((r.details as any).skipped).toBe(true);
		rmSync(dir, { recursive: true });
	});

	it("detects innerHTML XSS", () => {
		const dir = makeProject({ "app.ts": "el.innerHTML = userInput;" });
		const r = runSecurity(dir);
		expect(r.issues.some((i) => i.rule === "CWE-79" && i.message.includes("innerHTML"))).toBe(true);
		rmSync(dir, { recursive: true });
	});

	it("detects dangerouslySetInnerHTML", () => {
		const dir = makeProject({ "App.tsx": "<div dangerouslySetInnerHTML={{ __html: data }} />" });
		const r = runSecurity(dir);
		expect(r.issues.some((i) => i.rule === "CWE-79" && i.message.includes("dangerouslySetInnerHTML"))).toBe(true);
		rmSync(dir, { recursive: true });
	});

	it("detects eval", () => {
		const dir = makeProject({ "app.ts": "const result = eval(code);" });
		const r = runSecurity(dir);
		expect(r.issues.some((i) => i.rule === "CWE-94")).toBe(true);
		rmSync(dir, { recursive: true });
	});

	it("detects SQL injection via template literals", () => {
		const dir = makeProject({ "db.ts": "db.query(`SELECT * FROM users WHERE id = ${userId}`);" });
		const r = runSecurity(dir);
		expect(r.issues.some((i) => i.rule === "CWE-89")).toBe(true);
		rmSync(dir, { recursive: true });
	});

	it("detects weak crypto (Math.random for tokens)", () => {
		const dir = makeProject({ "auth.ts": "const sessionToken = Math.random().toString(36); // token" });
		const r = runSecurity(dir);
		expect(r.issues.some((i) => i.rule === "CWE-330")).toBe(true);
		rmSync(dir, { recursive: true });
	});

	it("does NOT false-positive on RegExp.exec", () => {
		const dir = makeProject({ "parser.ts": "const match = /pattern/.exec(input);" });
		const r = runSecurity(dir);
		expect(r.issues.some((i) => i.rule === "CWE-78")).toBe(false);
		rmSync(dir, { recursive: true });
	});

	it("detects child_process.exec with string arg", () => {
		const dir = makeProject({ "run.ts": 'cp.exec("rm -rf /", callback);' });
		const r = runSecurity(dir);
		expect(r.issues.some((i) => i.rule === "CWE-78")).toBe(true);
		rmSync(dir, { recursive: true });
	});

	it("detects missing CSP in index.html", () => {
		const dir = makeProject(
			{ "app.ts": "export const x = 1;" },
			{ "index.html": "<!DOCTYPE html><html><head></head><body></body></html>" },
		);
		const r = runSecurity(dir);
		expect(r.issues.some((i) => i.rule === "CWE-1021")).toBe(true);
		rmSync(dir, { recursive: true });
	});

	it("does NOT false-positive on key= in object literals", () => {
		const dir = makeProject({ "config.ts": 'const config = { key: "value", token: getToken() };' });
		const r = runSecurity(dir);
		expect(r.issues.some((i) => i.rule === "CWE-598")).toBe(false);
		rmSync(dir, { recursive: true });
	});

	it("detects sensitive params in URL query strings", () => {
		const dir = makeProject({ "api.ts": "const url = `https://api.example.com/auth?token=abc123`;" });
		const r = runSecurity(dir);
		expect(r.issues.some((i) => i.rule === "CWE-598")).toBe(true);
		rmSync(dir, { recursive: true });
	});

	it("does not flag pattern words inside multi-line string descriptions", () => {
		const dir = makeProject({
			"meta.ts": `export const META = {
  description:
    "Covers eval, dangerouslySetInnerHTML, document.write — common XSS vectors",
};`,
		});
		const r = runSecurity(dir);
		expect(r.issues.length).toBe(0);
		rmSync(dir, { recursive: true });
	});

	it("scores 100 for clean code", () => {
		const dir = makeProject({ "app.ts": "export function greet(name: string) { return `Hello ${name}`; }" });
		const r = runSecurity(dir);
		expect(r.score).toBe(100);
		rmSync(dir, { recursive: true });
	});
});
