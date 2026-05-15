/** TypeScript type checking runner. */

import { existsSync } from "node:fs";
import { join } from "node:path";
import type { CheckResult, Issue } from "../types.js";
import { gradeFromScore } from "../types.js";
import { run } from "./exec.js";

export function runTypeCheck(cwd: string): CheckResult {
	const start = Date.now();
	const issues: Issue[] = [];

	if (
		!existsSync(join(cwd, "tsconfig.json")) &&
		!existsSync(join(cwd, "tsconfig.app.json"))
	) {
		return {
			name: "types",
			score: 0,
			grade: "F",
			details: { skipped: true, reason: "no tsconfig.json" },
			issues: [],
			duration: Date.now() - start,
		};
	}

	const { stdout } = run("npx tsc --noEmit 2>&1 || true", cwd, 30_000);
	const lines = stdout.split("\n");
	for (const line of lines) {
		const match = line.match(/^(.+)\((\d+),\d+\): error (TS\d+): (.+)/);
		if (match) {
			issues.push({
				severity: "error",
				file: match[1],
				line: parseInt(match[2]),
				rule: match[3],
				message: match[4],
			});
		}
	}

	const errorCount = issues.length;
	const score = errorCount === 0 ? 100 : Math.max(0, 100 - errorCount * 5);

	return {
		name: "types",
		score,
		grade: gradeFromScore(score),
		details: { errors: errorCount, ok: errorCount === 0 },
		issues,
		duration: Date.now() - start,
	};
}
