/** Shared filesystem utilities — eliminates duplicate file-walking across runners. */

import { lstatSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, extname, join } from "node:path";

export interface SourceFile {
	path: string; // relative to cwd
	fullPath: string;
	base: string; // filename without extension
	ext: string;
	content: string;
	lines: number;
	isTest: boolean;
}

export const SKIP_DIRS = new Set(["node_modules", "dist", ".git", ".vibe-check", "coverage", "test-results", "__pycache__"]);
const CODE_EXTS = new Set([".ts", ".tsx", ".js", ".jsx"]);
const ALL_EXTS = new Set([...CODE_EXTS, ".json", ".env", ".yaml", ".yml", ".toml"]);
const CSS_EXTS = new Set([".css"]);

/** Walk source directories and return all code files. */
export function collectSourceFiles(
	cwd: string,
	opts?: { includeTests?: boolean; extraExts?: boolean; cssOnly?: boolean; roots?: string[] },
): SourceFile[] {
	const files: SourceFile[] = [];
	const dirs = opts?.roots ?? ["src", "web/src"];
	const exts = opts?.cssOnly ? CSS_EXTS : opts?.extraExts ? ALL_EXTS : CODE_EXTS;
	for (const dir of dirs) {
		try {
			walk(join(cwd, dir), cwd, files, exts);
		} catch {
			/* dir doesn't exist */
		}
	}
	if (opts?.includeTests) return files;
	return files.filter((f) => !f.isTest);
}

/** Get CSS files from source directories. */
export function getCSSFiles(cwd: string): SourceFile[] {
	return collectSourceFiles(cwd, { cssOnly: true, includeTests: true });
}

/** Get only production source files (no tests). */
export function getProductionFiles(cwd: string): SourceFile[] {
	return collectSourceFiles(cwd);
}

/** Get only test files. */
export function getTestFiles(cwd: string): SourceFile[] {
	return collectSourceFiles(cwd, { includeTests: true }).filter((f) => f.isTest);
}

/** Read a file relative to cwd, return empty string on error. */
export function readSafe(cwd: string, path: string): string {
	try {
		return readFileSync(join(cwd, path), "utf-8");
	} catch {
		return "";
	}
}

/** Parse package.json dependencies. */
export function readDeps(cwd: string): Record<string, string> {
	const pkg = readSafe(cwd, "package.json");
	if (!pkg) return {};
	try {
		const parsed = JSON.parse(pkg);
		return { ...parsed.dependencies, ...parsed.devDependencies };
	} catch {
		return {};
	}
}

function walk(dir: string, cwd: string, out: SourceFile[], exts: Set<string>): void {
	for (const entry of readdirSync(dir)) {
		if (SKIP_DIRS.has(entry)) continue;
		const full = join(dir, entry);
		// Skip symlinks to prevent traversal attacks (H3)
		if (lstatSync(full).isSymbolicLink()) continue;
		if (statSync(full).isDirectory()) {
			walk(full, cwd, out, exts);
		} else {
			const ext = extname(entry);
			if (!exts.has(ext)) continue;
			// Skip files over 1MB to prevent memory issues (M1)
			if (statSync(full).size > 1_000_000) continue;
			const content = readFileSync(full, "utf-8");
			const relPath = full.replace(`${cwd}/`, "");
			const isTest = entry.includes(".test.") || entry.includes(".spec.") || relPath.includes("__tests__");
			out.push({
				path: relPath,
				fullPath: full,
				base: basename(entry, ext),
				ext,
				content,
				lines: content.split("\n").length,
				isTest,
			});
		}
	}
}
