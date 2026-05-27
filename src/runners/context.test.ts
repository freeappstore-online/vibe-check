import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runContext } from "./context.js";

function makeProject(files: Record<string, string>): string {
	const dir = mkdtempSync(join(tmpdir(), "vcqa-ctx-"));
	writeFileSync(join(dir, "package.json"), "{}");
	mkdirSync(join(dir, "src"), { recursive: true });
	for (const [name, content] of Object.entries(files)) {
		const full = join(dir, "src", name);
		mkdirSync(join(full, ".."), { recursive: true });
		writeFileSync(full, content);
	}
	return dir;
}

describe("runContext", () => {
	it("skips when no source files", () => {
		const dir = mkdtempSync(join(tmpdir(), "vcqa-ctx-"));
		writeFileSync(join(dir, "package.json"), "{}");
		const r = runContext(dir);
		expect(r.score).toBe(100);
		expect((r.details as any).skipped).toBe(true);
		rmSync(dir, { recursive: true });
	});

	it("flags high-token files", () => {
		const bigContent = "x".repeat(20000); // ~5700 tokens at 3.5 chars/token
		const dir = makeProject({ "big.ts": `export const data = "${bigContent}";` });
		const r = runContext(dir);
		expect(r.issues.some((i) => i.rule === "high-token-count")).toBe(true);
		rmSync(dir, { recursive: true });
	});

	it("flags files with too many imports", () => {
		const imports = Array.from({ length: 20 }, (_, i) => `import { x${i} } from "./mod${i}.js";`).join("\n");
		const dir = makeProject({ "big.ts": `${imports}\nexport const y = 1;` });
		const r = runContext(dir);
		expect(r.issues.some((i) => i.rule === "heavy-imports")).toBe(true);
		rmSync(dir, { recursive: true });
	});

	it("detects circular dependencies", () => {
		const dir = makeProject({
			"a.ts": 'import { b } from "./b.js";\nexport const a = 1;',
			"b.ts": 'import { a } from "./a.js";\nexport const b = 2;',
		});
		const r = runContext(dir);
		expect(r.issues.some((i) => i.rule === "circular-dependency")).toBe(true);
		rmSync(dir, { recursive: true });
	});

	it("detects circular deps between .ts and .tsx files", () => {
		const dir = makeProject({
			"App.tsx": 'import { util } from "./util.js";\nexport const App = () => util;',
			"util.ts": 'import { App } from "./App.js";\nexport const util = App;',
		});
		const r = runContext(dir);
		expect(r.issues.some((i) => i.rule === "circular-dependency")).toBe(true);
		rmSync(dir, { recursive: true });
	});

	it("flags context sinks (many imports, few exports)", () => {
		const imports = Array.from({ length: 10 }, (_, i) => `import { x${i} } from "./mod${i}.js";`).join("\n");
		const dir = makeProject({ "sink.ts": `${imports}\nconst y = 1;` });
		const r = runContext(dir);
		expect(r.issues.some((i) => i.rule === "context-sink")).toBe(true);
		rmSync(dir, { recursive: true });
	});

	it("resolves nested ../ imports for cycle detection", () => {
		const dir = makeProject({
			"components/deep/Widget.tsx": 'import { util } from "../../util.js";\nexport const Widget = () => util;',
			"util.ts": 'import { Widget } from "./components/deep/Widget.js";\nexport const util = Widget;',
		});
		const r = runContext(dir);
		expect(r.issues.some((i) => i.rule === "circular-dependency")).toBe(true);
		rmSync(dir, { recursive: true });
	});

	it("scores 100 for small self-contained files", () => {
		const dir = makeProject({
			"app.ts": "export const greeting = 'hello';",
			"util.ts": "export function add(a: number, b: number) { return a + b; }",
		});
		const r = runContext(dir);
		expect(r.score).toBe(100);
		rmSync(dir, { recursive: true });
	});
});
