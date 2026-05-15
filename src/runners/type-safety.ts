/** Type safety check — count unsafe patterns: `as any`, explicit `any`, non-null assertions. */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import type { CheckResult, Issue } from "../types.js";
import { gradeFromScore } from "../types.js";

interface UnsafePattern {
	name: string;
	pattern: RegExp;
	severity: "error" | "warning";
	weight: number; // score penalty per occurrence
}

const PATTERNS: UnsafePattern[] = [
	{ name: "as any", pattern: /\bas any\b/g, severity: "warning", weight: 2 },
	{ name: ": any", pattern: /:\s*any\b/g, severity: "warning", weight: 1 },
	{ name: "non-null assertion (!.)", pattern: /\w+!\./g, severity: "info" as any, weight: 0.5 },
	{ name: "@ts-ignore", pattern: /@ts-ignore/g, severity: "error", weight: 5 },
	{ name: "@ts-expect-error", pattern: /@ts-expect-error/g, severity: "warning", weight: 2 },
	{ name: "@ts-nocheck", pattern: /@ts-nocheck/g, severity: "error", weight: 10 },
];

export function runTypeSafety(cwd: string): CheckResult {
	const start = Date.now();
	const issues: Issue[] = [];
	const counts: Record<string, number> = {};
	let totalPenalty = 0;

	const files: string[] = [];
	const dirs = ["src", "web/src"];
	for (const dir of dirs) {
		try {
			collectFiles(join(cwd, dir), files);
		} catch { /* dir doesn't exist */ }
	}

	if (files.length === 0) {
		return { name: "type-safety", score: 100, grade: "A", details: { skipped: true, reason: "no source files" }, issues: [], duration: Date.now() - start };
	}

	for (const file of files) {
		const content = readFileSync(file, "utf-8");
		const relPath = file.replace(cwd + "/", "");
		const lines = content.split("\n");

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			if (line.trim().startsWith("//")) continue;

			for (const p of PATTERNS) {
				const matches = line.match(p.pattern);
				if (matches) {
					counts[p.name] = (counts[p.name] || 0) + matches.length;
					totalPenalty += p.weight * matches.length;
					for (const _m of matches) {
						issues.push({ severity: p.severity, message: p.name, file: relPath, line: i + 1, rule: "unsafe-type" });
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
		details: { ...counts, filesScanned: files.length, totalUnsafe: issues.length },
		issues,
		duration: Date.now() - start,
	};
}

function collectFiles(dir: string, out: string[]): void {
	for (const entry of readdirSync(dir)) {
		if (entry === "node_modules" || entry === "dist") continue;
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) {
			collectFiles(full, out);
		} else {
			const ext = extname(entry);
			if ((ext === ".ts" || ext === ".tsx") && !entry.includes(".test.") && !entry.includes(".spec.")) {
				out.push(full);
			}
		}
	}
}
