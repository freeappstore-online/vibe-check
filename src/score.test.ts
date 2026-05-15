import { describe, it, expect } from "vitest";
import { computeScore } from "./score.js";
import type { CheckResult } from "./types.js";

function check(name: string, score: number, skipped = false): CheckResult {
	return {
		name,
		score,
		grade: "A",
		details: skipped ? { skipped: true, reason: "test" } : {},
		issues: [],
		duration: 0,
	};
}

describe("computeScore", () => {
	it("returns 0 for empty checks", () => {
		expect(computeScore([])).toBe(0);
	});

	it("returns 0 when all checks skipped", () => {
		expect(computeScore([check("lint", 0, true), check("types", 0, true)])).toBe(0);
	});

	it("computes weighted average", () => {
		// testing has weight 25, lint has weight 5 — testing dominates
		const result = computeScore([check("testing", 100), check("lint", 0)]);
		// weighted: (100*25 + 0*5) / (25+5) = 2500/30 ≈ 83
		expect(result).toBe(83);
	});

	it("ignores skipped checks in weight", () => {
		const result = computeScore([check("testing", 80), check("lint", 0, true)]);
		// Only testing counted: 80
		expect(result).toBe(80);
	});

	it("testing carries the most weight", () => {
		// All perfect except testing is 0
		const checks = [
			check("structure", 100),
			check("lint", 100),
			check("types", 100),
			check("type-safety", 100),
			check("standards", 100),
			check("complexity", 100),
			check("duplication", 100),
			check("docs", 100),
			check("testing", 0),
			check("secrets", 100),
			check("security", 100),
			check("dependencies", 100),
		];
		const score = computeScore(checks);
		// testing is 30% weight, so max possible is ~70
		expect(score).toBeLessThan(75);
		expect(score).toBeGreaterThan(60);
	});

	it("perfect score when all checks score 100", () => {
		const checks = [
			check("structure", 100), check("lint", 100), check("types", 100),
			check("type-safety", 100), check("standards", 100), check("complexity", 100),
			check("duplication", 100), check("docs", 100), check("testing", 100),
			check("secrets", 100), check("security", 100), check("dependencies", 100),
		];
		expect(computeScore(checks)).toBe(100);
	});
});
