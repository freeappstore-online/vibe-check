import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runPerformance } from "./performance.js";

function makeProject(files: Record<string, string>): string {
	const dir = mkdtempSync(join(tmpdir(), "vcqa-perf-"));
	writeFileSync(join(dir, "package.json"), "{}");
	mkdirSync(join(dir, "src"), { recursive: true });
	for (const [name, content] of Object.entries(files)) {
		const full = join(dir, "src", name);
		mkdirSync(join(full, ".."), { recursive: true });
		writeFileSync(full, content);
	}
	return dir;
}

describe("runPerformance", () => {
	it("skips when no source files", () => {
		const dir = mkdtempSync(join(tmpdir(), "vcqa-perf-"));
		writeFileSync(join(dir, "package.json"), "{}");
		const r = runPerformance(dir);
		expect(r.score).toBe(100);
		expect((r.details as any).skipped).toBe(true);
		rmSync(dir, { recursive: true });
	});

	it("detects img without loading=lazy", () => {
		const dir = makeProject({
			"App.tsx": `export function App() { return <img src="photo.jpg" alt="x" />; }`,
		});
		const r = runPerformance(dir);
		expect(r.issues.some((i) => i.rule === "img-no-lazy")).toBe(true);
		rmSync(dir, { recursive: true });
	});

	it("accepts img with loading=lazy", () => {
		const dir = makeProject({
			"App.tsx": `export function App() { return <img src="photo.jpg" alt="x" loading="lazy" />; }`,
		});
		const r = runPerformance(dir);
		expect(r.issues.some((i) => i.rule === "img-no-lazy")).toBe(false);
		rmSync(dir, { recursive: true });
	});

	it("detects useEffect without dependency array", () => {
		const dir = makeProject({
			"App.tsx": `import { useEffect } from "react";
export function App() {
  useEffect(() => {
    document.title = "hello";
  })
  return <div />;
}`,
		});
		const r = runPerformance(dir);
		expect(r.issues.some((i) => i.rule === "effect-no-deps")).toBe(true);
		rmSync(dir, { recursive: true });
	});

	it("accepts useEffect with dependency array", () => {
		const dir = makeProject({
			"App.tsx": `import { useEffect } from "react";
export function App() {
  useEffect(() => {
    document.title = "hello";
  }, [])
  return <div />;
}`,
		});
		const r = runPerformance(dir);
		expect(r.issues.some((i) => i.rule === "effect-no-deps")).toBe(false);
		rmSync(dir, { recursive: true });
	});

	it("detects sync localStorage in render path", () => {
		const dir = makeProject({
			"App.tsx": `export function App() {
  const theme = localStorage.getItem("theme");
  return <div className={theme}>hello</div>;
}`,
		});
		const r = runPerformance(dir);
		expect(r.issues.some((i) => i.rule === "sync-storage-render")).toBe(true);
		rmSync(dir, { recursive: true });
	});

	it("allows localStorage inside useEffect", () => {
		const dir = makeProject({
			"App.tsx": `import { useEffect } from "react";
export function App() {
  useEffect(() => {
    localStorage.setItem("visited", "true");
  }, [])
  return <div />;
}`,
		});
		const r = runPerformance(dir);
		expect(r.issues.some((i) => i.rule === "sync-storage-render")).toBe(false);
		rmSync(dir, { recursive: true });
	});

	it("allows localStorage inside event handler", () => {
		const dir = makeProject({
			"App.tsx": `export function App() {
  const handleSave = () => {
    localStorage.setItem("data", "value");
  };
  return <button onClick={handleSave}>Save</button>;
}`,
		});
		const r = runPerformance(dir);
		expect(r.issues.some((i) => i.rule === "sync-storage-render")).toBe(false);
		rmSync(dir, { recursive: true });
	});

	it("scores 100 for clean code", () => {
		const dir = makeProject({
			"App.tsx": `import { useEffect } from "react";
export function App() {
  useEffect(() => { document.title = "App"; }, []);
  return <div>Hello</div>;
}`,
		});
		const r = runPerformance(dir);
		expect(r.score).toBe(100);
		expect(r.issues).toHaveLength(0);
		rmSync(dir, { recursive: true });
	});

	it("does not flag img in non-JSX files", () => {
		const dir = makeProject({
			"util.ts": "const html = '<img src=\"x.png\">';",
		});
		const r = runPerformance(dir);
		expect(r.issues.some((i) => i.rule === "img-no-lazy")).toBe(false);
		rmSync(dir, { recursive: true });
	});
});
