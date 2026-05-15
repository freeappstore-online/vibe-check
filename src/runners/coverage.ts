/** Coverage runner — runs tests with coverage and parses the summary. */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { CheckResult, StackInfo } from "../types.js";
import { gradeFromScore } from "../types.js";
import { run } from "./exec.js";

export function runCoverage(cwd: string, stack: StackInfo): CheckResult {
	const start = Date.now();

	if (stack.testRunner === "none") {
		return {
			name: "coverage",
			score: 0,
			grade: "F",
			details: { skipped: true, reason: "no test runner" },
			issues: [],
			duration: Date.now() - start,
		};
	}

	// Run tests with coverage
	const cmd =
		stack.testRunner === "vitest"
			? "npx vitest run --coverage 2>/dev/null || true"
			: "npx jest --coverage --coverageReporters=json-summary 2>/dev/null || true";
	run(cmd, cwd, 120_000);

	// Look for coverage summary
	const searchPaths = [
		"coverage/coverage-summary.json",
		"test-results/coverage/coverage-summary.json",
	];
	let summary: any = null;
	for (const p of searchPaths) {
		const full = join(cwd, p);
		if (existsSync(full)) {
			try {
				summary = JSON.parse(readFileSync(full, "utf-8"));
				break;
			} catch {
				/* parse failed */
			}
		}
	}

	if (!summary?.total) {
		return {
			name: "coverage",
			score: 0,
			grade: "F",
			details: { skipped: true, reason: "no coverage data generated" },
			issues: [],
			duration: Date.now() - start,
		};
	}

	const stmts = summary.total.statements?.pct || 0;
	const lines = summary.total.lines?.pct || 0;
	const branches = summary.total.branches?.pct || 0;
	const functions = summary.total.functions?.pct || 0;

	// Score is the average of all four metrics
	const score = Math.round((stmts + lines + branches + functions) / 4);

	return {
		name: "coverage",
		score,
		grade: gradeFromScore(score),
		details: { statements: stmts, lines, branches, functions },
		issues: [],
		duration: Date.now() - start,
	};
}
