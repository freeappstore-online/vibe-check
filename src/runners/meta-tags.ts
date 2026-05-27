/** Meta Tags check — validates HTML head for SEO, social sharing, and discoverability. */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { CheckResult, Issue } from "../types.js";
import { gradeFromScore } from "../types.js";

const HTML_PATHS = ["index.html", "web/index.html", "public/index.html"];

export function runMetaTags(cwd: string): CheckResult {
	const start = Date.now();
	const issues: Issue[] = [];

	let htmlFile = "";
	let html = "";
	for (const h of HTML_PATHS) {
		const full = join(cwd, h);
		if (existsSync(full)) {
			htmlFile = h;
			html = readFileSync(full, "utf-8");
			break;
		}
	}

	if (!htmlFile) {
		return {
			name: "meta-tags",
			score: 100,
			grade: "A",
			details: { skipped: true, reason: "no index.html" },
			issues: [],
			duration: Date.now() - start,
		};
	}

	// Extract <title> content
	const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
	const title = titleMatch?.[1]?.trim() || "";

	// ── Required for basic discoverability ──

	if (!title) {
		issues.push({
			severity: "error",
			message: "Missing <title> — page has no title in browser tabs or search results",
			file: htmlFile,
			rule: "missing-title",
		});
	} else if (title.length < 5 || /^(app|untitled|my app|vite app|react app)$/i.test(title)) {
		issues.push({
			severity: "warning",
			message: `Generic <title>: "${title}" — use a descriptive title`,
			file: htmlFile,
			rule: "generic-title",
		});
	}

	if (
		!/<meta\s[^>]*name=["']description["'][^>]*content=["'][^"']+["']/.test(html) &&
		!/<meta\s[^>]*content=["'][^"']+["'][^>]*name=["']description["']/.test(html)
	) {
		issues.push({
			severity: "warning",
			message: 'Missing <meta name="description"> — blank snippet in search results and link previews',
			file: htmlFile,
			rule: "missing-description",
		});
	}

	// ── Favicon ──

	if (!/<link\s[^>]*rel=["'](?:icon|shortcut icon|apple-touch-icon)["']/.test(html)) {
		issues.push({ severity: "warning", message: "No favicon — browser tab shows generic icon", file: htmlFile, rule: "missing-favicon" });
	}

	// ── Open Graph (social sharing) ──

	const ogTitle = /<meta\s[^>]*property=["']og:title["']/.test(html);
	const ogDesc = /<meta\s[^>]*property=["']og:description["']/.test(html);
	const ogImage = /<meta\s[^>]*property=["']og:image["']/.test(html);

	if (!ogTitle && !ogDesc && !ogImage) {
		issues.push({
			severity: "warning",
			message: "No Open Graph tags — shared links on social media will have no preview",
			file: htmlFile,
			rule: "missing-og",
		});
	} else {
		if (!ogTitle) {
			issues.push({ severity: "info", message: "Missing og:title", file: htmlFile, rule: "missing-og-title" });
		}
		if (!ogDesc) {
			issues.push({ severity: "info", message: "Missing og:description", file: htmlFile, rule: "missing-og-desc" });
		}
		if (!ogImage) {
			issues.push({
				severity: "info",
				message: "Missing og:image — shared links won't have a preview image",
				file: htmlFile,
				rule: "missing-og-image",
			});
		}
	}

	// ── Theme color ──

	if (!/<meta\s[^>]*name=["']theme-color["']/.test(html)) {
		issues.push({
			severity: "info",
			message: 'Missing <meta name="theme-color"> — browser toolbar won\'t match app color',
			file: htmlFile,
			rule: "missing-theme-color",
		});
	}

	// ── Charset ──

	if (!/<meta\s[^>]*charset=/i.test(html)) {
		issues.push({
			severity: "warning",
			message: "Missing <meta charset> — text encoding may be misinterpreted",
			file: htmlFile,
			rule: "missing-charset",
		});
	}

	// ── Viewport ──

	if (!/<meta\s[^>]*name=["']viewport["']/.test(html)) {
		issues.push({
			severity: "error",
			message: 'Missing <meta name="viewport"> — page won\'t scale correctly on mobile',
			file: htmlFile,
			rule: "missing-viewport",
		});
	}

	const errors = issues.filter((i) => i.severity === "error").length;
	const warnings = issues.filter((i) => i.severity === "warning").length;
	const score = Math.max(0, Math.min(100, 100 - errors * 20 - warnings * 10));

	return {
		name: "meta-tags",
		score,
		grade: gradeFromScore(score),
		details: {
			htmlFile,
			hasTitle: !!title,
			hasDescription: !issues.some((i) => i.rule === "missing-description"),
			hasFavicon: !issues.some((i) => i.rule === "missing-favicon"),
			hasOG: ogTitle || ogDesc || ogImage,
			hasThemeColor: !issues.some((i) => i.rule === "missing-theme-color"),
			hasViewport: !issues.some((i) => i.rule === "missing-viewport"),
		},
		issues,
		duration: Date.now() - start,
	};
}
