import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runPWAManifest } from "./pwa-manifest.js";

const GOOD_MANIFEST = JSON.stringify({
	name: "My App",
	short_name: "App",
	start_url: "/",
	display: "standalone",
	icons: [
		{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
		{ src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
	],
});

const HTML_WITH_MANIFEST = '<!DOCTYPE html><html><head><link rel="manifest" href="/manifest.json"></head><body></body></html>';
const HTML_NO_MANIFEST = "<!DOCTYPE html><html><head></head><body></body></html>";

function makeProject(opts: { manifest?: string; manifestPath?: string; html?: string; htmlPath?: string }): string {
	const dir = mkdtempSync(join(tmpdir(), "vcqa-pwa-"));
	writeFileSync(join(dir, "package.json"), "{}");
	if (opts.html !== undefined) {
		const htmlPath = opts.htmlPath || "index.html";
		mkdirSync(join(dir, htmlPath, ".."), { recursive: true });
		writeFileSync(join(dir, htmlPath), opts.html);
	}
	if (opts.manifest !== undefined) {
		const manifestPath = opts.manifestPath || "public/manifest.json";
		mkdirSync(join(dir, manifestPath, ".."), { recursive: true });
		writeFileSync(join(dir, manifestPath), opts.manifest);
	}
	return dir;
}

describe("runPWAManifest", () => {
	it("skips when no manifest link and no manifest file", () => {
		const dir = makeProject({ html: HTML_NO_MANIFEST });
		const r = runPWAManifest(dir);
		expect(r.score).toBe(100);
		expect((r.details as any).skipped).toBe(true);
		rmSync(dir, { recursive: true });
	});

	it("skips when no HTML and no manifest", () => {
		const dir = mkdtempSync(join(tmpdir(), "vcqa-pwa-"));
		writeFileSync(join(dir, "package.json"), "{}");
		const r = runPWAManifest(dir);
		expect(r.score).toBe(100);
		expect((r.details as any).skipped).toBe(true);
		rmSync(dir, { recursive: true });
	});

	it("fails when HTML links manifest but file is missing", () => {
		const dir = makeProject({ html: HTML_WITH_MANIFEST });
		const r = runPWAManifest(dir);
		expect(r.score).toBe(0);
		expect(r.issues.some((i) => i.rule === "manifest-missing")).toBe(true);
		rmSync(dir, { recursive: true });
	});

	it("fails on invalid JSON", () => {
		const dir = makeProject({ html: HTML_WITH_MANIFEST, manifest: "not json{{{" });
		const r = runPWAManifest(dir);
		expect(r.score).toBe(0);
		expect(r.issues.some((i) => i.rule === "manifest-invalid-json")).toBe(true);
		rmSync(dir, { recursive: true });
	});

	it("flags missing required fields", () => {
		const dir = makeProject({ html: HTML_WITH_MANIFEST, manifest: JSON.stringify({ name: "App" }) });
		const r = runPWAManifest(dir);
		expect(r.issues.some((i) => i.rule === "manifest-field-missing" && i.message.includes("icons"))).toBe(true);
		expect(r.issues.some((i) => i.rule === "manifest-field-missing" && i.message.includes("start_url"))).toBe(true);
		expect(r.issues.some((i) => i.rule === "manifest-field-missing" && i.message.includes("display"))).toBe(true);
		rmSync(dir, { recursive: true });
	});

	it("flags missing 192x192 icon", () => {
		const manifest = JSON.stringify({
			name: "App",
			start_url: "/",
			display: "standalone",
			icons: [{ src: "/icon-512.png", sizes: "512x512", type: "image/png" }],
		});
		const dir = makeProject({ html: HTML_WITH_MANIFEST, manifest });
		const r = runPWAManifest(dir);
		expect(r.issues.some((i) => i.rule === "manifest-icon-192")).toBe(true);
		expect(r.issues.some((i) => i.rule === "manifest-icon-512")).toBe(false);
		rmSync(dir, { recursive: true });
	});

	it("flags missing 512x512 icon", () => {
		const manifest = JSON.stringify({
			name: "App",
			start_url: "/",
			display: "standalone",
			icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }],
		});
		const dir = makeProject({ html: HTML_WITH_MANIFEST, manifest });
		const r = runPWAManifest(dir);
		expect(r.issues.some((i) => i.rule === "manifest-icon-512")).toBe(true);
		expect(r.issues.some((i) => i.rule === "manifest-icon-192")).toBe(false);
		rmSync(dir, { recursive: true });
	});

	it("warns when manifest exists but HTML doesn't link it", () => {
		const dir = makeProject({ html: HTML_NO_MANIFEST, manifest: GOOD_MANIFEST });
		const r = runPWAManifest(dir);
		expect(r.issues.some((i) => i.rule === "manifest-not-linked")).toBe(true);
		rmSync(dir, { recursive: true });
	});

	it("warns on invalid display mode", () => {
		const manifest = JSON.stringify({
			name: "App",
			start_url: "/",
			display: "immersive",
			icons: [
				{ src: "/icon-192.png", sizes: "192x192", type: "image/png" },
				{ src: "/icon-512.png", sizes: "512x512", type: "image/png" },
			],
		});
		const dir = makeProject({ html: HTML_WITH_MANIFEST, manifest });
		const r = runPWAManifest(dir);
		expect(r.issues.some((i) => i.rule === "manifest-display-invalid")).toBe(true);
		rmSync(dir, { recursive: true });
	});

	it("scores 100 for a complete manifest", () => {
		const dir = makeProject({ html: HTML_WITH_MANIFEST, manifest: GOOD_MANIFEST });
		const r = runPWAManifest(dir);
		expect(r.score).toBe(100);
		expect(r.issues).toHaveLength(0);
		rmSync(dir, { recursive: true });
	});

	it("finds manifest at web/public/manifest.json", () => {
		const dir = makeProject({
			html: HTML_WITH_MANIFEST,
			htmlPath: "web/index.html",
			manifest: GOOD_MANIFEST,
			manifestPath: "web/public/manifest.json",
		});
		const r = runPWAManifest(dir);
		expect(r.score).toBe(100);
		expect((r.details as any).manifestPath).toBe("web/public/manifest.json");
		rmSync(dir, { recursive: true });
	});
});
