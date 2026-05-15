/** Complexity analysis — counts lines, functions, and cognitive complexity via AST-free heuristics. */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import type { CheckResult, Issue } from "../types.js";
import { gradeFromScore } from "../types.js";

interface FunctionMetric {
	file: string;
	name: string;
	lines: number;
	complexity: number;
}

const MAX_FUNCTION_LINES = 60;
const MAX_COMPLEXITY = 15;

export function runComplexity(cwd: string): CheckResult {
	const start = Date.now();
	const issues: Issue[] = [];
	const functions: FunctionMetric[] = [];

	// Find all TS/JS source files (not tests, not node_modules)
	const srcDirs = ["src", "web/src"];
	const files: string[] = [];
	for (const dir of srcDirs) {
		try {
			collectFiles(join(cwd, dir), files);
		} catch {
			/* dir doesn't exist */
		}
	}

	let totalLines = 0;
	const totalFiles = files.length;
	let longFunctions = 0;
	let complexFunctions = 0;

	for (const file of files) {
		const content = readFileSync(file, "utf-8");
		const lines = content.split("\n");
		totalLines += lines.length;

		// Simple heuristic: find function boundaries and measure complexity
		const funcs = extractFunctions(content, file.replace(cwd + "/", ""));
		for (const f of funcs) {
			functions.push(f);
			if (f.lines > MAX_FUNCTION_LINES) {
				longFunctions++;
				issues.push({
					severity: "warning",
					message: `${f.name}: ${f.lines} lines (max ${MAX_FUNCTION_LINES})`,
					file: f.file,
					rule: "long-function",
				});
			}
			if (f.complexity > MAX_COMPLEXITY) {
				complexFunctions++;
				issues.push({
					severity: "warning",
					message: `${f.name}: complexity ${f.complexity} (max ${MAX_COMPLEXITY})`,
					file: f.file,
					rule: "high-complexity",
				});
			}
		}
	}

	// Score: start at 100, -3 per long function, -5 per complex function
	const score = Math.max(
		0,
		Math.min(100, 100 - longFunctions * 3 - complexFunctions * 5),
	);

	return {
		name: "complexity",
		score,
		grade: gradeFromScore(score),
		details: {
			totalFiles,
			totalLines,
			longFunctions,
			complexFunctions,
			functionCount: functions.length,
		},
		issues,
		duration: Date.now() - start,
	};
}

function collectFiles(dir: string, out: string[]): void {
	for (const entry of readdirSync(dir)) {
		if (entry === "node_modules" || entry === "dist" || entry === ".git")
			continue;
		const full = join(dir, entry);
		const stat = statSync(full);
		if (stat.isDirectory()) {
			collectFiles(full, out);
		} else {
			const ext = extname(entry);
			if (
				(ext === ".ts" || ext === ".tsx" || ext === ".js" || ext === ".jsx") &&
				!entry.includes(".test.") &&
				!entry.includes(".spec.")
			) {
				out.push(full);
			}
		}
	}
}

/** Simple heuristic function extraction — not a full AST parser but good enough for metrics. */
function extractFunctions(content: string, filePath: string): FunctionMetric[] {
	const funcs: FunctionMetric[] = [];
	const lines = content.split("\n");
	// Track brace nesting
	let funcStart = -1;
	let funcName = "";
	let braceCount = 0;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const trimmed = line.trim();

		// Detect function start
		if (funcStart === -1) {
			const match =
				trimmed.match(/^(?:export\s+)?(?:async\s+)?function\s+(\w+)/) ||
				trimmed.match(
					/^(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*(?:async\s*)?\(/,
				) ||
				trimmed.match(
					/^(?:private|public|protected)?\s*(?:async\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*\w[^{]*)?\{/,
				) ||
				trimmed.match(/^(?:async\s+)?(\w+)\s*\([^)]*\)\s*\{/);
			if (match) {
				funcStart = i;
				funcName = match[1] || "anonymous";
				braceCount = 0;
			}
		}

		// Track brace depth
		if (funcStart !== -1) {
			for (const ch of line) {
				if (ch === "{") braceCount++;
				if (ch === "}") braceCount--;
			}
			if (braceCount <= 0 && i > funcStart) {
				const funcLines = i - funcStart + 1;
				const funcContent = lines.slice(funcStart, i + 1).join("\n");
				funcs.push({
					file: filePath,
					name: funcName,
					lines: funcLines,
					complexity: measureComplexity(funcContent),
				});
				funcStart = -1;
			}
		}
	}

	return funcs;
}

/** Heuristic cognitive complexity — counts nesting and branching. */
function measureComplexity(code: string): number {
	let complexity = 0;
	const lines = code.split("\n");

	for (const line of lines) {
		const trimmed = line.trim();
		// +1 for each branch/loop keyword
		if (
			/\b(if|else if|else|switch|for|while|do|catch|&&|\|\||[?]:)\b/.test(
				trimmed,
			)
		) {
			complexity++;
		}
		// +1 for ternary
		if (/\?.*:/.test(trimmed) && !trimmed.startsWith("//")) {
			complexity++;
		}
	}

	return complexity;
}
