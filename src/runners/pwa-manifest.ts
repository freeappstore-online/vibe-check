/** PWA Manifest check — validates manifest.json for installability. */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { CheckResult, Issue } from "../types.js";
import { gradeFromScore } from "../types.js";

const MANIFEST_PATHS = [
	"manifest.json",
	"manifest.webmanifest",
	"public/manifest.json",
	"public/manifest.webmanifest",
	"web/public/manifest.json",
	"web/public/manifest.webmanifest",
	"web/manifest.json",
];

const REQUIRED_FIELDS = ["name", "icons", "start_url", "display"] as const;

export function runPWAManifest(cwd: string): CheckResult {
	const start = Date.now();
	const issues: Issue[] = [];

	const skip = (reason: string) => ({
		name: "pwa-manifest",
		score: 100,
		grade: "A" as const,
		details: { skipped: true, reason },
		issues: [],
		duration: Date.now() - start,
	});

	// Check if any index.html links to a manifest
	const htmlPaths = ["index.html", "web/index.html", "public/index.html"];
	let hasManifestLink = false;
	for (const h of htmlPaths) {
		const full = join(cwd, h);
		if (!existsSync(full)) continue;
		const html = readFileSync(full, "utf-8");
		if (/rel=["']manifest["']/.test(html)) {
			hasManifestLink = true;
			break;
		}
	}

	// Find the manifest file
	let manifestPath = "";
	let manifestContent = "";
	for (const p of MANIFEST_PATHS) {
		const full = join(cwd, p);
		if (existsSync(full)) {
			manifestPath = p;
			manifestContent = readFileSync(full, "utf-8");
			break;
		}
	}

	if (!manifestPath) {
		if (!hasManifestLink) return skip("no manifest link in HTML");
		issues.push({
			severity: "error",
			message: "HTML links to manifest.json but the file is missing from the source tree",
			rule: "manifest-missing",
		});
		return {
			name: "pwa-manifest",
			score: 0,
			grade: gradeFromScore(0),
			details: { manifestPath: null },
			issues,
			duration: Date.now() - start,
		};
	}

	let manifest: Record<string, unknown>;
	try {
		manifest = JSON.parse(manifestContent);
	} catch {
		issues.push({
			severity: "error",
			message: "manifest.json contains invalid JSON",
			file: manifestPath,
			rule: "manifest-invalid-json",
		});
		return {
			name: "pwa-manifest",
			score: 0,
			grade: gradeFromScore(0),
			details: { manifestPath },
			issues,
			duration: Date.now() - start,
		};
	}

	// Check required fields
	for (const field of REQUIRED_FIELDS) {
		if (!manifest[field]) {
			issues.push({
				severity: "error",
				message: `Missing required field "${field}" in manifest`,
				file: manifestPath,
				rule: "manifest-field-missing",
			});
		}
	}

	// Validate icons
	const icons = manifest.icons as Array<{ src?: string; sizes?: string; type?: string }> | undefined;
	if (icons && Array.isArray(icons)) {
		const sizes = icons.map((i) => i.sizes || "").join(" ");
		if (!sizes.includes("192x192")) {
			issues.push({
				severity: "warning",
				message: "Missing 192x192 icon — required for Android homescreen",
				file: manifestPath,
				rule: "manifest-icon-192",
			});
		}
		if (!sizes.includes("512x512")) {
			issues.push({
				severity: "warning",
				message: "Missing 512x512 icon — required for Android splash screen",
				file: manifestPath,
				rule: "manifest-icon-512",
			});
		}
		for (const icon of icons) {
			if (!icon.src) {
				issues.push({
					severity: "error",
					message: "Icon entry missing src",
					file: manifestPath,
					rule: "manifest-icon-no-src",
				});
			}
		}
	}

	// Validate display mode
	const display = manifest.display as string | undefined;
	if (display && !["standalone", "fullscreen", "minimal-ui", "browser"].includes(display)) {
		issues.push({
			severity: "warning",
			message: `Invalid display mode "${display}" — use standalone, fullscreen, minimal-ui, or browser`,
			file: manifestPath,
			rule: "manifest-display-invalid",
		});
	}

	// Check for missing manifest link in HTML
	if (!hasManifestLink) {
		issues.push({
			severity: "warning",
			message: 'manifest.json exists but no <link rel="manifest"> in HTML — browser won\'t discover it',
			file: manifestPath,
			rule: "manifest-not-linked",
		});
	}

	const errors = issues.filter((i) => i.severity === "error").length;
	const warnings = issues.filter((i) => i.severity === "warning").length;
	const score = Math.max(0, Math.min(100, 100 - errors * 20 - warnings * 10));

	return {
		name: "pwa-manifest",
		score,
		grade: gradeFromScore(score),
		details: {
			manifestPath,
			hasName: !!manifest.name,
			hasIcons: !!icons?.length,
			hasStartUrl: !!manifest.start_url,
			hasDisplay: !!manifest.display,
		},
		issues,
		duration: Date.now() - start,
	};
}
