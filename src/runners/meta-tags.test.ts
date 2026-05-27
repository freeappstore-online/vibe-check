import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runMetaTags } from "./meta-tags.js";

const FULL_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="A great app for doing things" />
  <meta name="theme-color" content="#111" />
  <meta property="og:title" content="My App" />
  <meta property="og:description" content="Does great things" />
  <meta property="og:image" content="https://example.com/og.png" />
  <link rel="icon" href="/favicon.svg" />
  <title>My App — Great Things</title>
</head>
<body></body>
</html>`;

const BARE_HTML = `<!DOCTYPE html>
<html>
<head><title>App</title></head>
<body></body>
</html>`;

function makeProject(html?: string, htmlPath?: string): string {
	const dir = mkdtempSync(join(tmpdir(), "vcqa-meta-"));
	writeFileSync(join(dir, "package.json"), "{}");
	if (html !== undefined) {
		const p = htmlPath || "index.html";
		mkdirSync(join(dir, p, ".."), { recursive: true });
		writeFileSync(join(dir, p), html);
	}
	return dir;
}

describe("runMetaTags", () => {
	it("skips when no index.html", () => {
		const dir = makeProject();
		const r = runMetaTags(dir);
		expect(r.score).toBe(100);
		expect((r.details as any).skipped).toBe(true);
		rmSync(dir, { recursive: true });
	});

	it("scores 100 for complete HTML head", () => {
		const dir = makeProject(FULL_HTML);
		const r = runMetaTags(dir);
		expect(r.score).toBe(100);
		expect(r.issues).toHaveLength(0);
		rmSync(dir, { recursive: true });
	});

	it("flags missing viewport", () => {
		const html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>App</title></head><body></body></html>';
		const dir = makeProject(html);
		const r = runMetaTags(dir);
		expect(r.issues.some((i) => i.rule === "missing-viewport")).toBe(true);
		rmSync(dir, { recursive: true });
	});

	it("flags missing description", () => {
		const dir = makeProject(BARE_HTML);
		const r = runMetaTags(dir);
		expect(r.issues.some((i) => i.rule === "missing-description")).toBe(true);
		rmSync(dir, { recursive: true });
	});

	it("flags missing favicon", () => {
		const dir = makeProject(BARE_HTML);
		const r = runMetaTags(dir);
		expect(r.issues.some((i) => i.rule === "missing-favicon")).toBe(true);
		rmSync(dir, { recursive: true });
	});

	it("flags missing Open Graph tags", () => {
		const dir = makeProject(BARE_HTML);
		const r = runMetaTags(dir);
		expect(r.issues.some((i) => i.rule === "missing-og")).toBe(true);
		rmSync(dir, { recursive: true });
	});

	it("flags generic title", () => {
		const html =
			'<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width"><title>Vite App</title></head><body></body></html>';
		const dir = makeProject(html);
		const r = runMetaTags(dir);
		expect(r.issues.some((i) => i.rule === "generic-title")).toBe(true);
		rmSync(dir, { recursive: true });
	});

	it("flags missing title", () => {
		const html = '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body></body></html>';
		const dir = makeProject(html);
		const r = runMetaTags(dir);
		expect(r.issues.some((i) => i.rule === "missing-title")).toBe(true);
		rmSync(dir, { recursive: true });
	});

	it("flags missing charset", () => {
		const html = "<!DOCTYPE html><html><head><title>App</title></head><body></body></html>";
		const dir = makeProject(html);
		const r = runMetaTags(dir);
		expect(r.issues.some((i) => i.rule === "missing-charset")).toBe(true);
		rmSync(dir, { recursive: true });
	});

	it("gives individual OG issues when partial OG exists", () => {
		const html = `<!DOCTYPE html><html><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width">
<meta name="description" content="Desc" />
<meta property="og:title" content="Title" />
<link rel="icon" href="/favicon.ico" />
<title>My App</title></head><body></body></html>`;
		const dir = makeProject(html);
		const r = runMetaTags(dir);
		expect(r.issues.some((i) => i.rule === "missing-og")).toBe(false);
		expect(r.issues.some((i) => i.rule === "missing-og-desc")).toBe(true);
		expect(r.issues.some((i) => i.rule === "missing-og-image")).toBe(true);
		rmSync(dir, { recursive: true });
	});

	it("finds index.html at web/index.html", () => {
		const dir = makeProject(FULL_HTML, "web/index.html");
		const r = runMetaTags(dir);
		expect(r.score).toBe(100);
		expect((r.details as any).htmlFile).toBe("web/index.html");
		rmSync(dir, { recursive: true });
	});

	it("accepts description with reversed attribute order", () => {
		const html = `<!DOCTYPE html><html><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width">
<meta content="A real description" name="description" />
<meta property="og:title" content="T" /><meta property="og:description" content="D" /><meta property="og:image" content="I" />
<link rel="icon" href="/f.ico" /><meta name="theme-color" content="#000" />
<title>Real App</title></head><body></body></html>`;
		const dir = makeProject(html);
		const r = runMetaTags(dir);
		expect(r.issues.some((i) => i.rule === "missing-description")).toBe(false);
		rmSync(dir, { recursive: true });
	});
});
