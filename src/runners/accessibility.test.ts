import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runAccessibility } from "./accessibility.js";

function makeProject(files: Record<string, string>): string {
	const dir = mkdtempSync(join(tmpdir(), "vcqa-a11y-"));
	writeFileSync(join(dir, "package.json"), "{}");
	mkdirSync(join(dir, "src"), { recursive: true });
	for (const [name, content] of Object.entries(files)) {
		const full = join(dir, "src", name);
		mkdirSync(join(full, ".."), { recursive: true });
		writeFileSync(full, content);
	}
	return dir;
}

describe("runAccessibility", () => {
	it("skips when no JSX files", () => {
		const dir = makeProject({ "util.ts": "export const x = 1;" });
		const result = runAccessibility(dir);
		expect(result.score).toBe(100);
		expect((result.details as any).skipped).toBe(true);
		rmSync(dir, { recursive: true });
	});

	it("detects missing alt on img", () => {
		const dir = makeProject({
			"App.tsx": `export function App() { return <img src="photo.jpg" />; }`,
		});
		const result = runAccessibility(dir);
		expect(result.issues.some((i) => i.rule === "img-alt")).toBe(true);
		rmSync(dir, { recursive: true });
	});

	it("detects onClick on div without role", () => {
		const dir = makeProject({
			"App.tsx": `export function App() { return <div onClick={handleClick}>click me</div>; }`,
		});
		const result = runAccessibility(dir);
		expect(result.issues.some((i) => i.rule === "click-events")).toBe(true);
		rmSync(dir, { recursive: true });
	});

	it("detects missing html lang", () => {
		const dir = makeProject({ "App.tsx": `export function App() { return <div>hi</div>; }` });
		writeFileSync(join(dir, "index.html"), "<!DOCTYPE html><html><head></head><body></body></html>");
		const result = runAccessibility(dir);
		expect(result.issues.some((i) => i.rule === "html-lang")).toBe(true);
		rmSync(dir, { recursive: true });
	});

	it("detects autoFocus", () => {
		const dir = makeProject({
			"App.tsx": `export function App() { return <input autoFocus type="text" />; }`,
		});
		const result = runAccessibility(dir);
		expect(result.issues.some((i) => i.rule === "no-autofocus")).toBe(true);
		rmSync(dir, { recursive: true });
	});

	it("detects positive tabIndex", () => {
		const dir = makeProject({
			"App.tsx": `export function App() { return <div tabIndex={5}>x</div>; }`,
		});
		const result = runAccessibility(dir);
		expect(result.issues.some((i) => i.rule === "tabindex")).toBe(true);
		rmSync(dir, { recursive: true });
	});

	it("detects missing form label", () => {
		const dir = makeProject({
			"App.tsx": `export function App() { return <input type="text" />; }`,
		});
		const result = runAccessibility(dir);
		expect(result.issues.some((i) => i.rule === "form-label")).toBe(true);
		rmSync(dir, { recursive: true });
	});

	it("accepts input with aria-label", () => {
		const dir = makeProject({
			"App.tsx": `export function App() { return <input type="text" aria-label="Search" />; }`,
		});
		const result = runAccessibility(dir);
		expect(result.issues.some((i) => i.rule === "form-label")).toBe(false);
		rmSync(dir, { recursive: true });
	});

	it("scores 100 for accessible code", () => {
		const dir = makeProject({
			"App.tsx": `export function App() {
  return (
    <div>
      <img src="photo.jpg" alt="A nice photo" />
      <button onClick={handleClick}>Click</button>
    </div>
  );
}`,
		});
		const result = runAccessibility(dir);
		expect(result.score).toBe(100);
		rmSync(dir, { recursive: true });
	});
});
