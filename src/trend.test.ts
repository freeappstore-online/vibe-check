import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { computeTrend, formatTrend, trendHTML } from "./trend.js";
import type { VibeReport } from "./types.js";

function makeReport(overrides: Partial<VibeReport> = {}): VibeReport {
	return {
		version: "0.17.0",
		timestamp: "2026-05-27T10:00:00.000Z",
		score: 75,
		grade: "B",
		checks: [
			{ name: "lint", score: 80, grade: "B", details: {}, issues: [{ severity: "warning", message: "x", rule: "y" }], duration: 10 },
			{ name: "testing", score: 70, grade: "C", details: {}, issues: [], duration: 20 },
		],
		meta: { cwd: "/tmp/test", node: "v22", duration: 100, stack: {} as any, repoUrl: null, branch: "main" },
		...overrides,
	};
}

describe("computeTrend", () => {
	it("returns null when no previous report exists", () => {
		const dir = mkdtempSync(join(tmpdir(), "vcqa-trend-"));
		const result = computeTrend(makeReport(), dir);
		expect(result).toBeNull();
		rmSync(dir, { recursive: true });
	});

	it("returns null for corrupt previous report", () => {
		const dir = mkdtempSync(join(tmpdir(), "vcqa-trend-"));
		writeFileSync(join(dir, "report.json"), "not json");
		const result = computeTrend(makeReport(), dir);
		expect(result).toBeNull();
		rmSync(dir, { recursive: true });
	});

	it("computes positive delta for improvement", () => {
		const dir = mkdtempSync(join(tmpdir(), "vcqa-trend-"));
		writeFileSync(join(dir, "report.json"), JSON.stringify(makeReport({ score: 60 })));
		const result = computeTrend(makeReport({ score: 80 }), dir)!;
		expect(result.scoreDelta).toBe(20);
		rmSync(dir, { recursive: true });
	});

	it("computes negative delta for regression", () => {
		const dir = mkdtempSync(join(tmpdir(), "vcqa-trend-"));
		writeFileSync(join(dir, "report.json"), JSON.stringify(makeReport({ score: 90 })));
		const result = computeTrend(makeReport({ score: 75 }), dir)!;
		expect(result.scoreDelta).toBe(-15);
		rmSync(dir, { recursive: true });
	});

	it("computes per-check deltas", () => {
		const dir = mkdtempSync(join(tmpdir(), "vcqa-trend-"));
		writeFileSync(join(dir, "report.json"), JSON.stringify(makeReport()));
		const current = makeReport({
			checks: [
				{ name: "lint", score: 100, grade: "A", details: {}, issues: [], duration: 5 },
				{ name: "testing", score: 70, grade: "C", details: {}, issues: [], duration: 10 },
			],
		});
		const result = computeTrend(current, dir)!;
		const lintDelta = result.checkDeltas.find((d) => d.name === "lint");
		expect(lintDelta!.delta).toBe(20);
		expect(lintDelta!.prev).toBe(80);
		expect(lintDelta!.curr).toBe(100);
		rmSync(dir, { recursive: true });
	});

	it("counts fixed and new issues", () => {
		const dir = mkdtempSync(join(tmpdir(), "vcqa-trend-"));
		const prev = makeReport();
		writeFileSync(join(dir, "report.json"), JSON.stringify(prev));
		const current = makeReport({
			checks: [
				{ name: "lint", score: 100, grade: "A", details: {}, issues: [], duration: 5 },
				{ name: "testing", score: 70, grade: "C", details: {}, issues: [], duration: 10 },
			],
		});
		const result = computeTrend(current, dir)!;
		expect(result.fixedIssues).toBe(1);
		expect(result.newIssues).toBe(0);
		rmSync(dir, { recursive: true });
	});
});

describe("formatTrend", () => {
	it("shows up arrow for improvement", () => {
		const out = formatTrend({ scoreDelta: 5, checkDeltas: [], newIssues: 0, fixedIssues: 2, prevTimestamp: "2026-05-26T10:00:00Z" });
		expect(out).toContain("↑");
		expect(out).toContain("5 pts");
		expect(out).toContain("improved");
		expect(out).toContain("2 fixed");
	});

	it("shows down arrow for regression", () => {
		const out = formatTrend({ scoreDelta: -3, checkDeltas: [], newIssues: 4, fixedIssues: 0, prevTimestamp: "2026-05-26T10:00:00Z" });
		expect(out).toContain("↓");
		expect(out).toContain("declined");
		expect(out).toContain("4 new");
	});

	it("shows equals for unchanged", () => {
		const out = formatTrend({ scoreDelta: 0, checkDeltas: [], newIssues: 0, fixedIssues: 0, prevTimestamp: "2026-05-26T10:00:00Z" });
		expect(out).toContain("=");
		expect(out).toContain("unchanged");
	});
});

describe("trendHTML", () => {
	it("returns valid HTML with delta info", () => {
		const html = trendHTML({
			scoreDelta: 10,
			checkDeltas: [{ name: "lint", prev: 70, curr: 80, delta: 10 }],
			newIssues: 0,
			fixedIssues: 3,
			prevTimestamp: "2026-05-26T10:00:00Z",
		});
		expect(html).toContain("+10 pts");
		expect(html).toContain("3 fixed");
		expect(html).toContain("lint +10");
	});

	it("omits fixed/new when zero", () => {
		const html = trendHTML({ scoreDelta: 0, checkDeltas: [], newIssues: 0, fixedIssues: 0, prevTimestamp: "2026-05-26T10:00:00Z" });
		expect(html).not.toContain("fixed");
		expect(html).not.toContain("new");
	});
});
