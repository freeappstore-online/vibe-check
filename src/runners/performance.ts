/** Performance patterns — detects common perf anti-patterns in React/web code. */

import { getProductionFiles } from "../fs-utils.js";
import type { CheckResult, Issue } from "../types.js";
import { gradeFromScore } from "../types.js";

export function runPerformance(cwd: string): CheckResult {
	const start = Date.now();
	const issues: Issue[] = [];
	const files = getProductionFiles(cwd);

	if (files.length === 0) {
		return {
			name: "performance",
			score: 100,
			grade: "A",
			details: { skipped: true, reason: "no source files" },
			issues: [],
			duration: Date.now() - start,
		};
	}

	let imgNoLazy = 0;
	let effectNoDeps = 0;
	let inlineObjectInJsx = 0;
	let syncStorageInRender = 0;

	for (const f of files) {
		const lines = f.content.split("\n");
		const isJsx = f.ext === ".tsx" || f.ext === ".jsx";

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			const trimmed = line.trim();
			if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;

			// 1. <img> without loading="lazy" (JSX only)
			if (isJsx && /<img\b/.test(trimmed) && !/loading=/.test(trimmed)) {
				const block = lines.slice(i, Math.min(i + 5, lines.length)).join(" ");
				if (/<img\b/.test(block) && !/loading=/.test(block)) {
					imgNoLazy++;
					issues.push({
						severity: "warning",
						message: '<img> without loading="lazy" — delays initial paint for offscreen images',
						file: f.path,
						line: i + 1,
						rule: "img-no-lazy",
					});
				}
			}

			// 2. useEffect(() => { ... }) without dependency array
			if (/\buseEffect\s*\(\s*\(/.test(trimmed)) {
				const block = lines.slice(i, Math.min(i + 15, lines.length)).join("\n");
				const effectMatch = extractEffect(block);
				if (effectMatch === "no-deps") {
					effectNoDeps++;
					issues.push({
						severity: "error",
						message: "useEffect without dependency array — runs on every render",
						file: f.path,
						line: i + 1,
						rule: "effect-no-deps",
					});
				}
			}

			// 3. Inline object/array literals in JSX props (re-created every render)
			if (isJsx && /=\{\s*\{/.test(trimmed) && !/style=/.test(trimmed) && !/className/.test(trimmed)) {
				if (/<[A-Z]/.test(trimmed) || (i > 0 && /<[A-Z]/.test(lines[i - 1] || ""))) {
					inlineObjectInJsx++;
				}
			}

			// 4. Synchronous localStorage/sessionStorage in component body (not in useEffect/handler)
			if (isJsx && /\b(?:localStorage|sessionStorage)\.\w+\s*\(/.test(trimmed)) {
				const inEffect = isInsideEffect(lines, i);
				const inHandler = isInsideHandler(lines, i);
				if (!inEffect && !inHandler) {
					syncStorageInRender++;
					issues.push({
						severity: "warning",
						message: "Synchronous storage access in render path — move to useEffect or event handler",
						file: f.path,
						line: i + 1,
						rule: "sync-storage-render",
					});
				}
			}
		}
	}

	// Only warn about inline objects if there are many
	if (inlineObjectInJsx > 10) {
		issues.push({
			severity: "warning",
			message: `${inlineObjectInJsx} inline object literals in JSX props — extract to constants or useMemo to avoid re-renders`,
			rule: "inline-object-jsx",
		});
	}

	const errors = issues.filter((i) => i.severity === "error").length;
	const warnings = issues.filter((i) => i.severity === "warning").length;
	const score = Math.max(0, Math.min(100, 100 - errors * 10 - warnings * 3));

	return {
		name: "performance",
		score,
		grade: gradeFromScore(score),
		details: { filesScanned: files.length, imgNoLazy, effectNoDeps, inlineObjectInJsx, syncStorageInRender },
		issues,
		duration: Date.now() - start,
	};
}

function extractEffect(block: string): "no-deps" | "has-deps" | "unknown" {
	let depth = 0;
	let foundCallback = false;
	for (let i = 0; i < block.length; i++) {
		const ch = block[i];
		if (ch === "(") depth++;
		if (ch === ")") {
			depth--;
			if (depth === 0 && foundCallback) return "no-deps";
		}
		if (ch === "{") foundCallback = true;
		if (ch === "," && depth === 1 && foundCallback) return "has-deps";
		if (ch === "[" && depth === 1 && foundCallback) return "has-deps";
	}
	return "unknown";
}

function isInsideEffect(lines: string[], lineIdx: number): boolean {
	for (let i = lineIdx; i >= Math.max(0, lineIdx - 10); i--) {
		if (/\buseEffect\s*\(/.test(lines[i])) return true;
		if (/\buseCallback\s*\(/.test(lines[i])) return true;
		if (/\buseMemo\s*\(/.test(lines[i])) return true;
	}
	return false;
}

function isInsideHandler(lines: string[], lineIdx: number): boolean {
	for (let i = lineIdx; i >= Math.max(0, lineIdx - 5); i--) {
		const trimmed = lines[i].trim();
		if (/^(?:const|let|function)\s+\w*[Hh]andl/.test(trimmed)) return true;
		if (/^(?:const|let)\s+\w+\s*=\s*(?:async\s*)?\(/.test(trimmed)) return true;
		if (/on[A-Z]\w*=/.test(trimmed)) return true;
	}
	return false;
}
