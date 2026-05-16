import { describe, expect, it } from "vitest";
import { buildSparkline } from "./svg.js";

describe("buildSparkline", () => {
	it("returns empty string for empty values", () => {
		expect(buildSparkline([])).toBe("");
	});

	it("returns SVG with correct dimensions", () => {
		const svg = buildSparkline([50, 60, 70]);
		expect(svg).toContain('width="120"');
		expect(svg).toContain('height="30"');
		expect(svg).toContain("<polyline");
		expect(svg).toContain("<circle");
	});

	it("respects custom dimensions", () => {
		const svg = buildSparkline([50, 60], { width: 200, height: 40 });
		expect(svg).toContain('width="200"');
		expect(svg).toContain('height="40"');
	});

	it("respects custom color", () => {
		const svg = buildSparkline([50, 60], { color: "#ff0000" });
		expect(svg).toContain('stroke="#ff0000"');
		expect(svg).toContain('fill="#ff0000"');
	});

	it("renders correct number of dots", () => {
		const svg = buildSparkline([10, 20, 30, 40, 50]);
		const dots = svg.match(/<circle/g);
		expect(dots).toHaveLength(5);
	});

	it("handles single value", () => {
		const svg = buildSparkline([75]);
		expect(svg).toContain("<polyline");
		expect(svg).toContain("<circle");
	});

	it("clamps values to 0-100 range", () => {
		const svg = buildSparkline([-10, 150]);
		// Should not throw, and should produce valid SVG
		expect(svg).toContain("<svg");
		expect(svg).toContain("</svg>");
	});
});
