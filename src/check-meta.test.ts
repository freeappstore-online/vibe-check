import { describe, expect, it } from "vitest";
import { CHECK_META, getCheckMeta } from "./check-meta.js";

describe("CHECK_META", () => {
	const allEntries = Object.values(CHECK_META);
	const nonPremium = allEntries.filter((m) => !m.premium);

	it("has complete metadata for every non-premium check", () => {
		for (const meta of nonPremium) {
			expect(meta.label, `${meta.name}: missing label`).toBeTruthy();
			expect(meta.description.length, `${meta.name}: description too short`).toBeGreaterThan(50);
			expect(meta.risk.length, `${meta.name}: risk too short`).toBeGreaterThan(20);
			expect(meta.recommendation.length, `${meta.name}: recommendation too short`).toBeGreaterThan(20);
		}
	});

	it("has valid priorities", () => {
		for (const meta of allEntries) {
			expect(["critical", "high", "medium", "low"]).toContain(meta.priority);
		}
	});

	it("has valid categories", () => {
		const validCats = ["Foundations", "Quality", "Testing", "Architecture", "Security", "LLM Readiness", "AI Analysis"];
		for (const meta of allEntries) {
			expect(validCats, `${meta.name} has unknown category "${meta.category}"`).toContain(meta.category);
		}
	});

	it("weights sum to 100", () => {
		const total = allEntries.reduce((s, m) => s + m.weight, 0);
		expect(total).toBe(100);
	});

	it("testing has the highest weight", () => {
		const maxWeight = Math.max(...allEntries.map((m) => m.weight));
		expect(CHECK_META.testing.weight).toBe(maxWeight);
	});

	it("every entry has name matching its key", () => {
		for (const [key, meta] of Object.entries(CHECK_META)) {
			expect(meta.name, `key "${key}" doesn't match name "${meta.name}"`).toBe(key);
		}
	});
});

describe("getCheckMeta", () => {
	it("returns metadata for known checks", () => {
		const meta = getCheckMeta("lint");
		expect(meta.label).toBe("Lint");
		expect(meta.priority).toBe("high");
	});

	it("returns fallback for unknown checks", () => {
		const meta = getCheckMeta("unknown-check");
		expect(meta.name).toBe("unknown-check");
		expect(meta.priority).toBe("medium");
		expect(meta.weight).toBe(5);
	});
});
