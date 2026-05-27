import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runIOSSafeArea } from "./ios-safe-area.js";

const BOTH_META = `<!DOCTYPE html>
<html lang="en"><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
<meta name="apple-mobile-web-app-capable" content="yes" />
</head><body><div id="root"></div></body></html>`;

const COVER_ONLY = `<!DOCTYPE html>
<html lang="en"><head>
<meta name="viewport" content="width=device-width, viewport-fit=cover" />
</head><body></body></html>`;

const CAPABLE_ONLY = `<!DOCTYPE html>
<html lang="en"><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="apple-mobile-web-app-capable" content="yes" />
</head><body></body></html>`;

function makeProject(opts: { html?: string; htmlPath?: string; srcFiles?: Record<string, string> }): string {
	const dir = mkdtempSync(join(tmpdir(), "vcqa-safe-"));
	writeFileSync(join(dir, "package.json"), "{}");
	if (opts.html) {
		const htmlPath = opts.htmlPath || "index.html";
		mkdirSync(join(dir, htmlPath, ".."), { recursive: true });
		writeFileSync(join(dir, htmlPath), opts.html);
	}
	if (opts.srcFiles) {
		for (const [name, content] of Object.entries(opts.srcFiles)) {
			const full = join(dir, "src", name);
			mkdirSync(join(full, ".."), { recursive: true });
			writeFileSync(full, content);
		}
	}
	return dir;
}

describe("runIOSSafeArea", () => {
	it("skips when no index.html exists", () => {
		const dir = makeProject({ srcFiles: { "App.tsx": "export default () => <div />;" } });
		const r = runIOSSafeArea(dir);
		expect(r.score).toBe(100);
		expect((r.details as any).skipped).toBe(true);
		rmSync(dir, { recursive: true });
	});

	it("skips when viewport-fit=cover is missing", () => {
		const dir = makeProject({ html: CAPABLE_ONLY });
		const r = runIOSSafeArea(dir);
		expect(r.score).toBe(100);
		expect((r.details as any).skipped).toBe(true);
		expect((r.details as any).reason).toBe("not a fullscreen PWA");
		rmSync(dir, { recursive: true });
	});

	it("skips when apple-mobile-web-app-capable is missing", () => {
		const dir = makeProject({ html: COVER_ONLY });
		const r = runIOSSafeArea(dir);
		expect(r.score).toBe(100);
		expect((r.details as any).skipped).toBe(true);
		rmSync(dir, { recursive: true });
	});

	it("fails when both meta tags present but no safe-area CSS", () => {
		const dir = makeProject({ html: BOTH_META, srcFiles: { "App.tsx": "export default () => <div>Hello</div>;" } });
		const r = runIOSSafeArea(dir);
		expect(r.score).toBe(0);
		expect(r.issues).toHaveLength(1);
		expect(r.issues[0].rule).toBe("safe-area-missing");
		expect(r.issues[0].severity).toBe("warning");
		rmSync(dir, { recursive: true });
	});

	it("passes when safe-area found in .css file", () => {
		const dir = makeProject({ html: BOTH_META, srcFiles: { "index.css": "#root { padding-top: env(safe-area-inset-top); }" } });
		const r = runIOSSafeArea(dir);
		expect(r.score).toBe(100);
		expect(r.issues).toHaveLength(0);
		rmSync(dir, { recursive: true });
	});

	it("passes when safe-area found in TSX inline style", () => {
		const dir = makeProject({
			html: BOTH_META,
			srcFiles: { "App.tsx": `export default () => <div style={{ paddingTop: 'env(safe-area-inset-top)' }}>Hi</div>;` },
		});
		const r = runIOSSafeArea(dir);
		expect(r.score).toBe(100);
		expect(r.issues).toHaveLength(0);
		rmSync(dir, { recursive: true });
	});

	it("passes when safe-area found in Tailwind arbitrary value", () => {
		const dir = makeProject({
			html: BOTH_META,
			srcFiles: { "App.tsx": `export default () => <nav className="pb-[env(safe-area-inset-bottom)]">Nav</nav>;` },
		});
		const r = runIOSSafeArea(dir);
		expect(r.score).toBe(100);
		expect(r.issues).toHaveLength(0);
		rmSync(dir, { recursive: true });
	});

	it("passes when safe-area found in index.html style tag", () => {
		const html = `<!DOCTYPE html>
<html lang="en"><head>
<meta name="viewport" content="width=device-width, viewport-fit=cover" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<style>#root { padding-top: env(safe-area-inset-top); }</style>
</head><body></body></html>`;
		const dir = makeProject({ html });
		const r = runIOSSafeArea(dir);
		expect(r.score).toBe(100);
		expect(r.issues).toHaveLength(0);
		rmSync(dir, { recursive: true });
	});

	it("detects capable meta tag with reversed attribute order", () => {
		const html = `<!DOCTYPE html>
<html lang="en"><head>
<meta name="viewport" content="width=device-width, viewport-fit=cover" />
<meta content="yes" name="apple-mobile-web-app-capable" />
</head><body></body></html>`;
		const dir = makeProject({ html, srcFiles: { "App.tsx": "export default () => <div>Hi</div>;" } });
		const r = runIOSSafeArea(dir);
		expect(r.score).toBe(0);
		expect(r.issues[0].rule).toBe("safe-area-missing");
		rmSync(dir, { recursive: true });
	});

	it("finds index.html at web/index.html", () => {
		const dir = makeProject({ html: BOTH_META, htmlPath: "web/index.html" });
		const r = runIOSSafeArea(dir);
		expect(r.score).toBe(0);
		expect(r.issues[0].file).toBe("web/index.html");
		rmSync(dir, { recursive: true });
	});
});
