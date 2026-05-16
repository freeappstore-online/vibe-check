import { describe, expect, it } from "vitest";
import { gradeFromScore } from "./types.js";

describe("gradeFromScore", () => {
	it("returns A for 90-100", () => {
		expect(gradeFromScore(100)).toBe("A");
		expect(gradeFromScore(95)).toBe("A");
		expect(gradeFromScore(90)).toBe("A");
	});

	it("returns B for 75-89", () => {
		expect(gradeFromScore(89)).toBe("B");
		expect(gradeFromScore(80)).toBe("B");
		expect(gradeFromScore(75)).toBe("B");
	});

	it("returns C for 60-74", () => {
		expect(gradeFromScore(74)).toBe("C");
		expect(gradeFromScore(60)).toBe("C");
	});

	it("returns D for 40-59", () => {
		expect(gradeFromScore(59)).toBe("D");
		expect(gradeFromScore(40)).toBe("D");
	});

	it("returns F for 0-39", () => {
		expect(gradeFromScore(39)).toBe("F");
		expect(gradeFromScore(0)).toBe("F");
	});

	it("handles edge cases", () => {
		expect(gradeFromScore(-1)).toBe("F");
		expect(gradeFromScore(101)).toBe("A");
	});
});
