/** Error handling analysis — checks for poor error handling patterns. */

import { getProductionFiles } from "../fs-utils.js";
import { detectStack } from "../detect.js";
import type { CheckResult, Issue } from "../types.js";
import { gradeFromScore } from "../types.js";

export function runErrorHandling(cwd: string): CheckResult {
	const start = Date.now();
	const issues: Issue[] = [];
	const files = getProductionFiles(cwd);

	if (files.length === 0) {
		return {
			name: "error-handling",
			score: 100,
			grade: "A",
			details: { skipped: true, reason: "no source files" },
			issues: [],
			duration: Date.now() - start,
		};
	}

	const stack = detectStack(cwd);
	const isReact = stack.framework === "react";

	let emptyCatches = 0;
	let commentOnlyCatches = 0;
	let throwStrings = 0;
	let catchRethrows = 0;
	let missingPromiseCatch = 0;

	for (const file of files) {
		const lines = file.content.split("\n");

		// ── Empty catch blocks ──
		// Match catch followed by an empty block (possibly with whitespace)
		const emptyCatchRe = /\bcatch\s*(?:\([^)]*\))?\s*\{\s*\}/g;
		let match: RegExpExecArray | null;
		while ((match = emptyCatchRe.exec(file.content)) !== null) {
			const line = file.content.slice(0, match.index).split("\n").length;
			emptyCatches++;
			issues.push({
				severity: "warning",
				message: "Empty catch block — errors are silently swallowed",
				file: file.path,
				line,
				rule: "empty-catch",
			});
		}

		// ── Comment-only catch blocks ──
		// Match catch blocks that contain only comments (single-line // or /* */)
		const commentCatchRe = /\bcatch\s*(?:\([^)]*\))?\s*\{([^}]+)\}/g;
		while ((match = commentCatchRe.exec(file.content)) !== null) {
			const body = match[1].trim();
			// Skip if already caught as empty
			if (body === "") continue;
			// Check if all non-empty lines are comments
			const bodyLines = body.split("\n").filter((l) => l.trim().length > 0);
			const allComments = bodyLines.every((l) => {
				const t = l.trim();
				return t.startsWith("//") || t.startsWith("/*") || t.startsWith("*") || t.endsWith("*/");
			});
			if (allComments && bodyLines.length > 0) {
				const line = file.content.slice(0, match.index).split("\n").length;
				commentOnlyCatches++;
				issues.push({
					severity: "warning",
					message: "Catch block contains only comments — no actual error handling",
					file: file.path,
					line,
					rule: "comment-only-catch",
				});
			}
		}

		// ── Line-by-line checks ──
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			const trimmed = line.trim();

			// Skip comment lines and pattern/config definitions
			if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;
			if (/\bpattern\s*:|name:\s*["']|message:\s*["']|description:\s*["']|rule:\s*["']/.test(trimmed)) continue;

			// ── throw without Error object: throw "string" or throw 'string' or throw `template` ──
			if (/\bthrow\s+["'`]/.test(trimmed)) {
				throwStrings++;
				issues.push({
					severity: "warning",
					message: "throw with string literal — use throw new Error(...) for proper stack traces",
					file: file.path,
					line: i + 1,
					rule: "throw-string",
				});
			}

			// ── Catch-and-rethrow without context ──
			// Pattern: catch(e) { throw e } or catch(err) { throw err; }
			if (/\bcatch\s*\(\s*(\w+)\s*\)/.test(trimmed)) {
				const varName = trimmed.match(/\bcatch\s*\(\s*(\w+)\s*\)/)![1];
				// Check if the next non-empty line is just "throw <varName>" and closing brace
				const remaining = lines.slice(i + 1);
				const bodyLines: string[] = [];
				let braceDepth = 0;
				// Count opening braces on the catch line
				for (const ch of trimmed) {
					if (ch === "{") braceDepth++;
					if (ch === "}") braceDepth--;
				}
				if (braceDepth > 0) {
					for (const rl of remaining) {
						for (const ch of rl) {
							if (ch === "{") braceDepth++;
							if (ch === "}") braceDepth--;
						}
						if (braceDepth <= 0) break;
						bodyLines.push(rl.trim());
					}
					const meaningful = bodyLines.filter((l) => l.length > 0 && !l.startsWith("//"));
					if (meaningful.length === 1 && new RegExp(`^throw\\s+${varName}\\s*;?$`).test(meaningful[0])) {
						catchRethrows++;
						issues.push({
							severity: "warning",
							message: "Catch-and-rethrow without adding context — either add context or remove the try/catch",
							file: file.path,
							line: i + 1,
							rule: "catch-rethrow",
						});
					}
				}
			}
		}

		// ── Promise chains without .catch() ──
		// Look for .then( chains that don't end with .catch(
		const thenNoCatchRe = /\.then\s*\([^)]*\)\s*(?:;|\n|$)/g;
		while ((match = thenNoCatchRe.exec(file.content)) !== null) {
			// Check if there's a .catch on the same logical chain (look ahead a bit)
			const after = file.content.slice(match.index, match.index + match[0].length + 200);
			// If the .then ends with ; or newline without .catch, flag it
			if (!after.includes(".catch(") && !after.includes(".catch (")) {
				const line = file.content.slice(0, match.index).split("\n").length;
				missingPromiseCatch++;
				issues.push({
					severity: "info",
					message: "Promise .then() chain without .catch() — unhandled rejection risk",
					file: file.path,
					line,
					rule: "promise-no-catch",
				});
			}
		}
	}

	// ── Missing React Error Boundaries ──
	let missingErrorBoundary = false;
	if (isReact && files.length > 0) {
		const hasErrorBoundary = files.some(
			(f) =>
				/componentDidCatch/.test(f.content) ||
				/ErrorBoundary/.test(f.content) ||
				/error-boundary/i.test(f.path),
		);
		if (!hasErrorBoundary) {
			missingErrorBoundary = true;
			issues.push({
				severity: "warning",
				message: "React project has no Error Boundary — runtime errors will crash the entire app",
				rule: "missing-error-boundary",
			});
		}
	}

	// ── Scoring ──
	let score = 100;
	score -= emptyCatches * 5;
	score -= commentOnlyCatches * 3;
	score -= missingErrorBoundary ? 3 : 0;
	score -= throwStrings * 2;
	score -= catchRethrows * 2;
	score -= missingPromiseCatch * 1;
	score = Math.max(0, Math.min(100, score));

	return {
		name: "error-handling",
		score,
		grade: gradeFromScore(score),
		details: {
			filesScanned: files.length,
			emptyCatches,
			commentOnlyCatches,
			throwStrings,
			catchRethrows,
			missingPromiseCatch,
			missingErrorBoundary,
		},
		issues,
		duration: Date.now() - start,
	};
}
