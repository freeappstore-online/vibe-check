#!/usr/bin/env node
/** vibe-check — code health scanner for the AI coding era. */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { detectStack } from "./detect.js";
import { generateHTML } from "./report/html.js";
import { runComplexity } from "./runners/complexity.js";
import { runCoverage } from "./runners/coverage.js";
import { runDependencies } from "./runners/dependencies.js";
import { runLint } from "./runners/lint.js";
import { runSecrets } from "./runners/secrets.js";
import { runTests } from "./runners/tests.js";
import { runTypeCheck } from "./runners/types-check.js";
import { computeScore } from "./score.js";
import type { CheckResult, VibeReport } from "./types.js";
import { gradeFromScore } from "./types.js";

const VERSION = "0.1.0";
const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const cwd = resolve(args.find((a) => !a.startsWith("--")) || ".");
const outputDir = join(cwd, ".vibe-check");
const jsonOnly = flags.has("--json");
const ciMode = flags.has("--ci");
const skipTests = flags.has("--skip-tests");

async function main() {
	const start = Date.now();

	if (!jsonOnly) {
		console.log("");
		console.log("  \x1b[1mvibe-check\x1b[0m v" + VERSION);
		console.log("  \x1b[2m" + cwd + "\x1b[0m");
		console.log("");
	}

	// Detect stack
	const stack = detectStack(cwd);
	if (!jsonOnly) {
		console.log(
			"  stack: " +
				[
					stack.language,
					stack.framework,
					stack.bundler,
					stack.testRunner,
					stack.linter,
					stack.packageManager,
				]
					.filter((v) => v !== "none" && v !== "unknown")
					.join(" + "),
		);
		console.log("");
	}

	// Run checks
	const checks: CheckResult[] = [];

	const runners: { name: string; fn: () => CheckResult }[] = [
		{ name: "lint", fn: () => runLint(cwd, stack) },
		{ name: "types", fn: () => runTypeCheck(cwd) },
		{ name: "complexity", fn: () => runComplexity(cwd) },
		{ name: "secrets", fn: () => runSecrets(cwd) },
		{ name: "dependencies", fn: () => runDependencies(cwd, stack) },
	];

	if (!skipTests) {
		runners.push({ name: "tests", fn: () => runTests(cwd, stack) });
		runners.push({ name: "coverage", fn: () => runCoverage(cwd, stack) });
	}

	for (const runner of runners) {
		if (!jsonOnly) process.stdout.write("  " + runner.name.padEnd(14));
		const result = runner.fn();
		checks.push(result);
		if (!jsonOnly) {
			const skipped = (result.details as Record<string, unknown>).skipped;
			const color = skipped
				? "\x1b[2m"
				: result.grade === "A"
					? "\x1b[32m"
					: result.grade === "B"
						? "\x1b[33m"
						: "\x1b[31m";
			console.log(
				`${color}${skipped ? "skip" : result.grade}  ${result.score}/100\x1b[0m  \x1b[2m${result.duration}ms\x1b[0m`,
			);
		}
	}

	// Compute composite score
	const score = computeScore(checks);
	const grade = gradeFromScore(score);
	const duration = Date.now() - start;

	const report: VibeReport = {
		version: VERSION,
		timestamp: new Date().toISOString(),
		score,
		grade,
		checks,
		meta: { cwd, node: process.version, duration, stack },
	};

	// Write output
	if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });
	writeFileSync(
		join(outputDir, "report.json"),
		JSON.stringify(report, null, 2),
	);
	writeFileSync(join(outputDir, "report.html"), generateHTML(report));

	if (jsonOnly) {
		console.log(JSON.stringify(report));
	} else {
		const gc =
			grade === "A" ? "\x1b[32m" : grade === "B" ? "\x1b[33m" : "\x1b[31m";
		console.log("");
		console.log(
			`  ${gc}\x1b[1m${grade}\x1b[0m ${gc}${score}/100\x1b[0m  \x1b[2m${duration}ms\x1b[0m`,
		);
		console.log("");
		console.log(
			"  \x1b[2mReport: " + join(outputDir, "report.html") + "\x1b[0m",
		);
		console.log(
			"  \x1b[2mJSON:   " + join(outputDir, "report.json") + "\x1b[0m",
		);
		console.log("");
	}

	// CI mode: exit 1 if below threshold
	if (ciMode && score < 60) {
		process.exit(1);
	}

	// Open report in browser (macOS / Linux)
	if (!jsonOnly && !ciMode) {
		try {
			const { execSync } = await import("node:child_process");
			const openCmd = process.platform === "darwin" ? "open" : "xdg-open";
			execSync(`${openCmd} "${join(outputDir, "report.html")}"`, {
				stdio: "ignore",
			});
		} catch {
			/* failed to open browser — not critical */
		}
	}
}

main().catch((err) => {
	console.error("vibe-check error:", err);
	process.exit(1);
});
