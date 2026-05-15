/** Test runner — auto-detects vitest or jest. */

import type { CheckResult, StackInfo } from "../types.js";
import { gradeFromScore } from "../types.js";
import { run } from "./exec.js";

export function runTests(cwd: string, stack: StackInfo): CheckResult {
	const start = Date.now();

	if (stack.testRunner === "none") {
		return {
			name: "tests",
			score: 0,
			grade: "F",
			details: { skipped: true, reason: "no test runner" },
			issues: [],
			duration: Date.now() - start,
		};
	}

	const cmd =
		stack.testRunner === "vitest"
			? "npx vitest run --reporter=json 2>/dev/null || true"
			: "npx jest --json 2>/dev/null || true";

	const { stdout } = run(cmd, cwd, 120_000);

	// Extract JSON from output (vitest may print other stuff before the JSON)
	let data: any = null;
	try {
		// Find the JSON object in stdout
		const jsonStart = stdout.indexOf("{");
		if (jsonStart >= 0) {
			data = JSON.parse(stdout.slice(jsonStart));
		}
	} catch {
		/* parse failed */
	}

	if (!data) {
		return {
			name: "tests",
			score: 0,
			grade: "F",
			details: { error: "could not parse test output" },
			issues: [],
			duration: Date.now() - start,
		};
	}

	const passed = data.numPassedTests || 0;
	const failed = data.numFailedTests || 0;
	const total = data.numTotalTests || 0;

	const score = total === 0 ? 0 : Math.round((passed / total) * 100);

	return {
		name: "tests",
		score,
		grade: gradeFromScore(score),
		details: { passed, failed, total, runner: stack.testRunner },
		issues: [],
		duration: Date.now() - start,
	};
}
