/** Lint check — auto-detects biome or eslint. */

import type { CheckResult, Issue, StackInfo } from "../types.js";
import { gradeFromScore } from "../types.js";
import { run } from "./exec.js";

export function runLint(cwd: string, stack: StackInfo): CheckResult {
	const start = Date.now();
	const issues: Issue[] = [];

	if (stack.linter === "biome") {
		const { stdout } = run(
			"npx biome check src/ --reporter=json 2>/dev/null || true",
			cwd,
		);
		try {
			const data = JSON.parse(stdout);
			const diagnostics = data.diagnostics || [];
			for (const d of diagnostics) {
				issues.push({
					severity:
						d.severity === "error"
							? "error"
							: d.severity === "warning"
								? "warning"
								: "info",
					message: d.description || d.message || "lint issue",
					file: d.location?.path,
					line: d.location?.span?.start?.line,
					rule: d.category,
				});
			}
		} catch {
			// biome may not output valid JSON on some errors — count from summary
			const errors = stdout.match(/Found (\d+) error/)?.[1] || "0";
			const warnings = stdout.match(/Found (\d+) warning/)?.[1] || "0";
			for (let i = 0; i < parseInt(errors); i++)
				issues.push({ severity: "error", message: "lint error" });
			for (let i = 0; i < parseInt(warnings); i++)
				issues.push({ severity: "warning", message: "lint warning" });
		}
	} else if (stack.linter === "eslint") {
		const { stdout } = run(
			"npx eslint src/ --format json 2>/dev/null || true",
			cwd,
		);
		try {
			const files = JSON.parse(stdout);
			for (const file of files) {
				for (const msg of file.messages || []) {
					issues.push({
						severity: msg.severity === 2 ? "error" : "warning",
						message: msg.message,
						file: file.filePath,
						line: msg.line,
						rule: msg.ruleId,
					});
				}
			}
		} catch {
			/* eslint output parse failed */
		}
	} else {
		return {
			name: "lint",
			score: 0,
			grade: "F",
			details: { skipped: true, reason: "no linter detected" },
			issues: [],
			duration: Date.now() - start,
		};
	}

	const errors = issues.filter((i) => i.severity === "error").length;
	const warnings = issues.filter((i) => i.severity === "warning").length;
	// Score: start at 100, -10 per error, -2 per warning, floor at 0
	const score = Math.max(0, Math.min(100, 100 - errors * 10 - warnings * 2));

	return {
		name: "lint",
		score,
		grade: gradeFromScore(score),
		details: { errors, warnings, linter: stack.linter },
		issues,
		duration: Date.now() - start,
	};
}
