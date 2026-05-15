import { describe, it, expect } from "vitest";
import { detectStack } from "./detect.js";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const TMP = join(import.meta.dirname!, "__test_fixture__");

function setup(files: Record<string, string>) {
	rmSync(TMP, { recursive: true, force: true });
	mkdirSync(TMP, { recursive: true });
	for (const [path, content] of Object.entries(files)) {
		const full = join(TMP, path);
		mkdirSync(join(full, ".."), { recursive: true });
		writeFileSync(full, content);
	}
}

function cleanup() {
	rmSync(TMP, { recursive: true, force: true });
}

describe("detectStack", () => {
	it("detects TypeScript + React + Vite + Vitest + Biome + pnpm", () => {
		setup({
			"package.json": JSON.stringify({
				dependencies: { react: "^19" },
				devDependencies: { typescript: "^5", vite: "^6", vitest: "^4", "@biomejs/biome": "^2" },
			}),
			"tsconfig.json": "{}",
			"pnpm-lock.yaml": "",
		});
		const stack = detectStack(TMP);
		expect(stack.language).toBe("typescript");
		expect(stack.framework).toBe("react");
		expect(stack.bundler).toBe("vite");
		expect(stack.testRunner).toBe("vitest");
		expect(stack.linter).toBe("biome");
		expect(stack.packageManager).toBe("pnpm");
		cleanup();
	});

	it("detects JavaScript + no framework + Jest + ESLint + npm", () => {
		setup({
			"package.json": JSON.stringify({
				devDependencies: { jest: "^29", eslint: "^9" },
			}),
			"package-lock.json": "",
		});
		const stack = detectStack(TMP);
		expect(stack.language).toBe("unknown");
		expect(stack.framework).toBe("none");
		expect(stack.testRunner).toBe("jest");
		expect(stack.linter).toBe("eslint");
		expect(stack.packageManager).toBe("npm");
		cleanup();
	});

	it("detects empty project", () => {
		setup({ "package.json": "{}" });
		const stack = detectStack(TMP);
		expect(stack.language).toBe("unknown");
		expect(stack.framework).toBe("none");
		expect(stack.testRunner).toBe("none");
		expect(stack.linter).toBe("none");
		cleanup();
	});

	it("detects Vue + Webpack + Yarn", () => {
		setup({
			"package.json": JSON.stringify({
				dependencies: { vue: "^3" },
				devDependencies: { webpack: "^5" },
			}),
			"yarn.lock": "",
		});
		const stack = detectStack(TMP);
		expect(stack.framework).toBe("vue");
		expect(stack.bundler).toBe("webpack");
		expect(stack.packageManager).toBe("yarn");
		cleanup();
	});
});
