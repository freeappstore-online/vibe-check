import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { collectSourceFiles, getCSSFiles, getProductionFiles, getTestFiles, readDeps, readSafe, SKIP_DIRS } from "./fs-utils.js";

function makeProject(files: Record<string, string>): string {
	const dir = mkdtempSync(join(tmpdir(), "vcqa-fs-"));
	writeFileSync(join(dir, "package.json"), "{}");
	for (const [name, content] of Object.entries(files)) {
		const full = join(dir, name);
		mkdirSync(join(full, ".."), { recursive: true });
		writeFileSync(full, content);
	}
	return dir;
}

describe("collectSourceFiles", () => {
	it("finds ts/tsx files in src/", () => {
		const dir = makeProject({
			"src/app.ts": "export const x = 1;",
			"src/App.tsx": "export function App() {}",
		});
		const files = collectSourceFiles(dir);
		expect(files).toHaveLength(2);
		expect(files.map((f) => f.path).sort()).toEqual(["src/App.tsx", "src/app.ts"]);
		rmSync(dir, { recursive: true });
	});

	it("excludes test files by default", () => {
		const dir = makeProject({
			"src/app.ts": "export const x = 1;",
			"src/app.test.ts": "import { x } from './app'; test('x', () => {});",
		});
		const files = collectSourceFiles(dir);
		expect(files).toHaveLength(1);
		expect(files[0]!.isTest).toBe(false);
		rmSync(dir, { recursive: true });
	});

	it("includes test files when requested", () => {
		const dir = makeProject({
			"src/app.ts": "export const x = 1;",
			"src/app.test.ts": "import { x } from './app'; test('x', () => {});",
		});
		const files = collectSourceFiles(dir, { includeTests: true });
		expect(files).toHaveLength(2);
		const testFile = files.find((f) => f.isTest);
		expect(testFile).toBeDefined();
		expect(testFile!.path).toContain(".test.");
		rmSync(dir, { recursive: true });
	});

	it("skips node_modules and dist", () => {
		const dir = makeProject({
			"src/app.ts": "export const x = 1;",
			"src/node_modules/foo.ts": "bad",
			"src/dist/out.ts": "bad",
		});
		const files = collectSourceFiles(dir);
		expect(files).toHaveLength(1);
		rmSync(dir, { recursive: true });
	});

	it("skips files over 1MB", () => {
		const dir = makeProject({
			"src/small.ts": "export const x = 1;",
			"src/huge.ts": "x".repeat(1_100_000),
		});
		const files = collectSourceFiles(dir);
		expect(files).toHaveLength(1);
		expect(files[0]!.path).toBe("src/small.ts");
		rmSync(dir, { recursive: true });
	});
});

describe("getProductionFiles", () => {
	it("excludes test files", () => {
		const dir = makeProject({
			"src/app.ts": "export const x = 1;",
			"src/app.test.ts": "test('x', () => {});",
		});
		const files = getProductionFiles(dir);
		expect(files).toHaveLength(1);
		expect(files[0]!.isTest).toBe(false);
		rmSync(dir, { recursive: true });
	});
});

describe("getTestFiles", () => {
	it("returns only test files", () => {
		const dir = makeProject({
			"src/app.ts": "export const x = 1;",
			"src/app.test.ts": "test('x', () => {});",
		});
		const files = getTestFiles(dir);
		expect(files).toHaveLength(1);
		expect(files[0]!.isTest).toBe(true);
		rmSync(dir, { recursive: true });
	});
});

describe("getCSSFiles", () => {
	it("finds .css files in src/", () => {
		const dir = makeProject({
			"src/index.css": "body { margin: 0; }",
			"src/app.ts": "export const x = 1;",
		});
		const files = getCSSFiles(dir);
		expect(files).toHaveLength(1);
		expect(files[0]!.ext).toBe(".css");
		rmSync(dir, { recursive: true });
	});

	it("returns empty when no CSS files", () => {
		const dir = makeProject({ "src/app.ts": "export const x = 1;" });
		const files = getCSSFiles(dir);
		expect(files).toHaveLength(0);
		rmSync(dir, { recursive: true });
	});
});

describe("collectSourceFiles with roots", () => {
	it("walks custom root directories", () => {
		const dir = makeProject({
			"lib/util.ts": "export const x = 1;",
			"src/app.ts": "export const y = 2;",
		});
		mkdirSync(join(dir, "lib"), { recursive: true });
		writeFileSync(join(dir, "lib", "util.ts"), "export const x = 1;");
		const files = collectSourceFiles(dir, { roots: ["lib"] });
		expect(files.some((f) => f.path === "lib/util.ts")).toBe(true);
		rmSync(dir, { recursive: true });
	});
});

describe("SKIP_DIRS", () => {
	it("contains all expected directories", () => {
		expect(SKIP_DIRS.has("node_modules")).toBe(true);
		expect(SKIP_DIRS.has("dist")).toBe(true);
		expect(SKIP_DIRS.has(".git")).toBe(true);
		expect(SKIP_DIRS.has(".vibe-check")).toBe(true);
		expect(SKIP_DIRS.has("coverage")).toBe(true);
		expect(SKIP_DIRS.has("test-results")).toBe(true);
	});
});

describe("readSafe", () => {
	it("reads existing file", () => {
		const dir = makeProject({ "src/a.ts": "hello" });
		expect(readSafe(dir, "src/a.ts")).toBe("hello");
		rmSync(dir, { recursive: true });
	});

	it("returns empty string for missing file", () => {
		expect(readSafe("/tmp/nonexistent", "nope.ts")).toBe("");
	});
});

describe("readDeps", () => {
	it("reads dependencies from package.json", () => {
		const dir = mkdtempSync(join(tmpdir(), "vcqa-deps-"));
		writeFileSync(join(dir, "package.json"), JSON.stringify({ dependencies: { react: "^18" }, devDependencies: { vitest: "^4" } }));
		const deps = readDeps(dir);
		expect(deps.react).toBe("^18");
		expect(deps.vitest).toBe("^4");
		rmSync(dir, { recursive: true });
	});

	it("returns empty for missing package.json", () => {
		expect(readDeps("/tmp/nonexistent")).toEqual({});
	});
});
