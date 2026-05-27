/** Type safety check — count unsafe patterns: `as any`, explicit `any`, non-null assertions. */

import { getProductionFiles } from "../fs-utils.js";
import type { CheckResult, Issue } from "../types.js";
import { gradeFromScore } from "../types.js";

interface UnsafePattern {
	name: string;
	pattern: RegExp;
	severity: "error" | "warning" | "info";
	weight: number; // score penalty per occurrence
}

const PATTERNS: UnsafePattern[] = [
	{ name: "as any", pattern: /\bas any\b/g, severity: "warning", weight: 2 },
	{ name: ": any", pattern: /:\s*any\b/g, severity: "warning", weight: 1 },
	{ name: "non-null assertion (!.)", pattern: /\w+!\./g, severity: "info", weight: 0.5 },
	{ name: "@ts-ignore", pattern: /@ts-ignore/g, severity: "error", weight: 5 },
	{ name: "@ts-expect-error", pattern: /@ts-expect-error/g, severity: "warning", weight: 2 },
	{ name: "@ts-nocheck", pattern: /@ts-nocheck/g, severity: "error", weight: 10 },
];

export function runTypeSafety(cwd: string): CheckResult {
	const start = Date.now();
	const issues: Issue[] = [];
	const counts: Record<string, number> = {};
	let totalPenalty = 0;

	const srcFiles = getProductionFiles(cwd).filter((f) => f.ext === ".ts" || f.ext === ".tsx");

	if (srcFiles.length === 0) {
		return {
			name: "type-safety",
			score: 100,
			grade: "A",
			details: { skipped: true, reason: "no source files" },
			issues: [],
			duration: Date.now() - start,
		};
	}

	for (const file of srcFiles) {
		const lines = file.content.split("\n");

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			const trimmed = line.trim();
			const isComment = trimmed.startsWith("//") || trimmed.startsWith("*");
			// Skip pattern definition lines (prevents false positives when scanning own code)
			if (/\bpattern\s*:|name:\s*["']|message:\s*["']|description:\s*["']|risk:\s*["']|recommendation:\s*["']/.test(trimmed)) continue;
			if (/^["'`].*["'`],?$/.test(trimmed)) continue;

			for (const p of PATTERNS) {
				// "@ts-*" directives live in comments — don't skip them
				if (isComment && !p.name.startsWith("@ts-")) continue;
				const matches = line.match(p.pattern);
				if (matches) {
					counts[p.name] = (counts[p.name] || 0) + matches.length;
					totalPenalty += p.weight * matches.length;
					for (const _m of matches) {
						issues.push({ severity: p.severity, message: p.name, file: file.path, line: i + 1, rule: "unsafe-type" });
					}
				}
			}
		}
	}

	const score = Math.max(0, Math.min(100, Math.round(100 - totalPenalty)));

	return {
		name: "type-safety",
		score,
		grade: gradeFromScore(score),
		details: { ...counts, filesScanned: srcFiles.length, totalUnsafe: issues.length },
		issues,
		duration: Date.now() - start,
	};
}
