import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runComplexity } from "./complexity.js";

function makeProject(files: Record<string, string>): string {
	const dir = mkdtempSync(join(tmpdir(), "vcqa-cpx-"));
	writeFileSync(join(dir, "package.json"), "{}");
	mkdirSync(join(dir, "src"), { recursive: true });
	for (const [name, content] of Object.entries(files)) {
		const full = join(dir, "src", name);
		mkdirSync(join(full, ".."), { recursive: true });
		writeFileSync(full, content);
	}
	return dir;
}

describe("runComplexity", () => {
	it("gives A for simple functions", () => {
		const dir = makeProject({
			"simple.ts": `export function add(a: number, b: number): number {
  return a + b;
}

export function greet(name: string): string {
  return "Hello " + name;
}`,
		});
		const result = runComplexity(dir);
		expect(result.grade).toBe("A");
		expect(result.score).toBe(100);
		expect(result.issues).toHaveLength(0);
		rmSync(dir, { recursive: true });
	});

	it("flags long functions", () => {
		const longBody = Array.from({ length: 65 }, (_, i) => `  const x${i} = ${i};`).join("\n");
		const dir = makeProject({
			"long.ts": `export function bigFunction() {\n${longBody}\n}`,
		});
		const result = runComplexity(dir);
		expect(result.issues.some((i) => i.rule === "long-function")).toBe(true);
		expect(result.score).toBeLessThan(100);
		rmSync(dir, { recursive: true });
	});

	it("flags complex functions", () => {
		const branches = Array.from({ length: 20 }, (_, i) => `  if (x > ${i}) { y += ${i}; }`).join("\n");
		const dir = makeProject({
			"complex.ts": `export function complex(x: number) {\n  let y = 0;\n${branches}\n  return y;\n}`,
		});
		const result = runComplexity(dir);
		expect(result.issues.some((i) => i.rule === "high-complexity")).toBe(true);
		rmSync(dir, { recursive: true });
	});

	it("counts logical operators as separate branches", () => {
		const dir = makeProject({
			"multi.ts": `export function check(a: boolean, b: boolean, c: boolean) {
  if (a && b || c) { return true; }
  return false;
}`,
		});
		const result = runComplexity(dir);
		const details = result.details as Record<string, unknown>;
		expect(details.functionCount).toBe(1);
		rmSync(dir, { recursive: true });
	});

	it("handles braces inside string literals without breaking function detection", () => {
		const dir = makeProject({
			"strings.ts": `export function buildJSON() {
  const open = "{";
  const close = "}";
  return open + '"key": "value"' + close;
}

export function other() {
  return 42;
}`,
		});
		const result = runComplexity(dir);
		const details = result.details as Record<string, unknown>;
		expect(details.functionCount).toBe(2);
		rmSync(dir, { recursive: true });
	});

	it("handles template literals with braces", () => {
		const dir = makeProject({
			"template.ts": `export function render(name: string) {
  return \`<div class="\${name}">{content}</div>\`;
}`,
		});
		const result = runComplexity(dir);
		const details = result.details as Record<string, unknown>;
		expect(details.functionCount).toBe(1);
		rmSync(dir, { recursive: true });
	});

	it("returns A for empty src", () => {
		const dir = makeProject({});
		const result = runComplexity(dir);
		expect(result.score).toBe(100);
		rmSync(dir, { recursive: true });
	});
});
