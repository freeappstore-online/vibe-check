/** Auto-detect project stack from files in the working directory. */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { StackInfo } from "./types.js";

export function detectStack(cwd: string): StackInfo {
	const has = (f: string) => existsSync(join(cwd, f));
	const read = (f: string) => {
		try {
			return readFileSync(join(cwd, f), "utf-8");
		} catch {
			return "";
		}
	};

	const pkg = read("package.json");
	const deps = pkg ? JSON.parse(pkg) : {};
	const allDeps = { ...deps.dependencies, ...deps.devDependencies };

	const language =
		has("tsconfig.json") || has("tsconfig.app.json") || allDeps.typescript
			? "typescript"
			: allDeps.react || allDeps.vue
				? "javascript"
				: "unknown";

	const framework = allDeps.react
		? "react"
		: allDeps.vue
			? "vue"
			: allDeps.svelte
				? "svelte"
				: "none";

	const bundler = allDeps.vite
		? "vite"
		: allDeps.webpack
			? "webpack"
			: allDeps.esbuild
				? "esbuild"
				: "none";

	const testRunner = allDeps.vitest ? "vitest" : allDeps.jest ? "jest" : "none";

	const linter = allDeps["@biomejs/biome"]
		? "biome"
		: allDeps.eslint
			? "eslint"
			: "none";

	const packageManager = has("pnpm-lock.yaml")
		? "pnpm"
		: has("bun.lockb")
			? "bun"
			: has("yarn.lock")
				? "yarn"
				: "npm";

	return {
		language,
		framework,
		bundler,
		testRunner,
		linter,
		packageManager,
	} as StackInfo;
}
