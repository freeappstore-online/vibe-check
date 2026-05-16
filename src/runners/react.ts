/** React-specific checks — hooks rules, conditional hooks, missing keys, prop spreading. */

import type { CheckResult, Issue, StackInfo } from "../types.js";
import { gradeFromScore } from "../types.js";
import { getProductionFiles } from "../fs-utils.js";

export function runReact(cwd: string, stack: StackInfo): CheckResult {
	const start = Date.now();

	if (stack.framework !== "react") {
		return { name: "react", score: 100, grade: "A", details: { skipped: true, reason: "not a React project" }, issues: [], duration: Date.now() - start };
	}

	const files = getProductionFiles(cwd).filter((f) => f.ext === ".tsx" || f.ext === ".jsx");
	if (files.length === 0) {
		return { name: "react", score: 100, grade: "A", details: { skipped: true, reason: "no JSX/TSX files" }, issues: [], duration: Date.now() - start };
	}

	const issues: Issue[] = [];
	let conditionalHooks = 0;
	let missingKeys = 0;
	let propSpreading = 0;
	let inlineHandlers = 0;
	let indexKeys = 0;

	for (const f of files) {
		const lines = f.content.split("\n");

		// Track if we're inside a conditional block
		let condDepth = 0;

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			const trimmed = line.trim();

			// Skip comments
			if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;

			// Track conditional blocks
			if (/\b(if|else|switch)\s*\(/.test(trimmed)) condDepth++;
			if (condDepth > 0 && trimmed.includes("{")) condDepth++;
			if (condDepth > 0 && trimmed.includes("}")) condDepth--;

			// 1. Hooks called inside conditionals
			if (condDepth > 0 && /\buse[A-Z]\w*\s*\(/.test(trimmed) && !/\/\//.test(trimmed.split("use")[0]!)) {
				conditionalHooks++;
				issues.push({ severity: "error", message: "Hook called inside conditional — violates Rules of Hooks", file: f.path, line: i + 1, rule: "conditional-hook" });
			}

			// 2. Missing key in .map() returning JSX
			if (/\.map\s*\(/.test(trimmed)) {
				// Look ahead for JSX return without key
				const mapBlock = lines.slice(i, Math.min(i + 10, lines.length)).join("\n");
				if (/<\w/.test(mapBlock) && !mapBlock.includes("key=") && !mapBlock.includes("key:")) {
					missingKeys++;
					issues.push({ severity: "error", message: "JSX in .map() without key prop", file: f.path, line: i + 1, rule: "missing-key" });
				}
			}

			// 3. index as key
			if (/key=\{(?:i|idx|index)\}/.test(trimmed) || /key=\{.*(?:, *(?:i|idx|index)\))/.test(trimmed)) {
				indexKeys++;
				issues.push({ severity: "warning", message: "Using index as key — can cause rendering bugs with reorderable lists", file: f.path, line: i + 1, rule: "index-key" });
			}

			// 4. Prop spreading ({...props} on DOM elements)
			if (/\{\.\.\.(?!children)\w+\}/.test(trimmed) && /<[a-z]/.test(trimmed)) {
				propSpreading++;
				issues.push({ severity: "warning", message: "Spreading props onto DOM element — can pass unexpected attributes", file: f.path, line: i + 1, rule: "prop-spreading" });
			}

			// 5. Inline arrow functions in JSX event handlers (performance)
			if (/on[A-Z]\w*=\{(?:\(\) =>|function)/.test(trimmed)) {
				inlineHandlers++;
			}
		}
	}

	// Only warn about inline handlers if there are many
	if (inlineHandlers > 15) {
		issues.push({ severity: "warning", message: `${inlineHandlers} inline arrow functions in JSX handlers — extract to named functions for readability`, rule: "inline-handlers" });
	}

	const errors = issues.filter((i) => i.severity === "error").length;
	const warnings = issues.filter((i) => i.severity === "warning").length;
	const score = Math.max(0, Math.min(100, 100 - errors * 8 - warnings * 3));

	return {
		name: "react",
		score,
		grade: gradeFromScore(score),
		details: { jsxFiles: files.length, conditionalHooks, missingKeys, indexKeys, propSpreading, inlineHandlers },
		issues,
		duration: Date.now() - start,
	};
}
