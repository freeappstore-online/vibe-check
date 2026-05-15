/** Shared types for vibe-check */

export interface CheckResult {
	name: string;
	score: number; // 0-100
	grade: "A" | "B" | "C" | "D" | "F";
	details: Record<string, unknown>;
	issues: Issue[];
	duration: number; // ms
}

export interface Issue {
	severity: "error" | "warning" | "info";
	message: string;
	file?: string;
	line?: number;
	rule?: string;
}

export interface VibeReport {
	version: string;
	timestamp: string;
	score: number; // 0-100 composite
	grade: "A" | "B" | "C" | "D" | "F";
	checks: CheckResult[];
	meta: {
		cwd: string;
		node: string;
		duration: number; // total ms
		stack: StackInfo;
		repoUrl: string | null; // GitHub/GitLab URL for file links
		branch: string;
	};
}

export interface StackInfo {
	language: "typescript" | "javascript" | "unknown";
	framework: "react" | "vue" | "svelte" | "none" | "unknown";
	bundler: "vite" | "webpack" | "esbuild" | "none" | "unknown";
	testRunner: "vitest" | "jest" | "none" | "unknown";
	linter: "biome" | "eslint" | "none" | "unknown";
	packageManager: "pnpm" | "npm" | "yarn" | "bun" | "unknown";
}

export function gradeFromScore(score: number): "A" | "B" | "C" | "D" | "F" {
	if (score >= 90) return "A";
	if (score >= 75) return "B";
	if (score >= 60) return "C";
	if (score >= 40) return "D";
	return "F";
}
