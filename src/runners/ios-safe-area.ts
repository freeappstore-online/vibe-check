/** iOS Safe Area check — detects fullscreen PWAs missing env(safe-area-inset-*) padding. */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getCSSFiles, getProductionFiles } from "../fs-utils.js";
import type { CheckResult, Issue } from "../types.js";
import { gradeFromScore } from "../types.js";

const SAFE_AREA_RE = /safe-area-inset/;

export function runIOSSafeArea(cwd: string): CheckResult {
	const start = Date.now();
	const skip = (reason: string) => ({
		name: "ios-safe-area",
		score: 100,
		grade: "A" as const,
		details: { skipped: true, reason },
		issues: [],
		duration: Date.now() - start,
	});

	// 1. Find index.html
	const htmlPaths = ["index.html", "web/index.html", "public/index.html"];
	let htmlContent = "";
	let htmlFile = "";
	for (const h of htmlPaths) {
		const full = join(cwd, h);
		if (existsSync(full)) {
			htmlContent = readFileSync(full, "utf-8");
			htmlFile = h;
			break;
		}
	}
	if (!htmlFile) return skip("no index.html");

	// 2. Check trigger: both meta tags must be present
	const hasViewportCover = /viewport-fit=cover/.test(htmlContent);
	const hasCapable =
		/<meta\s[^>]*apple-mobile-web-app-capable[^>]*content=["']yes["']/.test(htmlContent) ||
		/<meta\s[^>]*content=["']yes["'][^>]*apple-mobile-web-app-capable/.test(htmlContent);
	if (!hasViewportCover || !hasCapable) return skip("not a fullscreen PWA");

	// 3. Search for safe-area-inset usage
	// 3a. Check index.html itself
	if (SAFE_AREA_RE.test(htmlContent)) {
		return {
			name: "ios-safe-area",
			score: 100,
			grade: "A",
			details: { htmlFile, foundIn: htmlFile },
			issues: [],
			duration: Date.now() - start,
		};
	}

	// 3b. Check .css files
	for (const cssFile of getCSSFiles(cwd)) {
		if (SAFE_AREA_RE.test(cssFile.content)) {
			return {
				name: "ios-safe-area",
				score: 100,
				grade: "A",
				details: { htmlFile, foundIn: cssFile.path },
				issues: [],
				duration: Date.now() - start,
			};
		}
	}

	// 3c. Check TSX/JSX source files (inline styles, Tailwind arbitrary values)
	const srcFiles = getProductionFiles(cwd).filter((f) => f.ext === ".tsx" || f.ext === ".jsx");
	for (const f of srcFiles) {
		if (SAFE_AREA_RE.test(f.content)) {
			return {
				name: "ios-safe-area",
				score: 100,
				grade: "A",
				details: { htmlFile, foundIn: f.path },
				issues: [],
				duration: Date.now() - start,
			};
		}
	}

	// 4. Not found — fail
	const issues: Issue[] = [
		{
			severity: "warning",
			message:
				"App uses viewport-fit=cover with apple-mobile-web-app-capable but no env(safe-area-inset-*) padding found. Content will render behind the Dynamic Island on iPhone. Add padding-top: env(safe-area-inset-top) to your root element.",
			file: htmlFile,
			rule: "safe-area-missing",
		},
	];

	return { name: "ios-safe-area", score: 0, grade: gradeFromScore(0), details: { htmlFile }, issues, duration: Date.now() - start };
}
