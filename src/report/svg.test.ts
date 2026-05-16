import { describe, expect, it } from "vitest";
import { buildBadge, buildPyramid, buildSparkline, buildTimeline } from "./svg.js";

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

describe("buildTimeline", () => {
	it("returns empty for no entries", () => {
		expect(buildTimeline([])).toBe("");
	});

	it("renders grid lines and dots for multiple entries", () => {
		const entries = [
			{ score: 60, timestamp: "2026-05-10T10:00:00Z" },
			{ score: 75, timestamp: "2026-05-11T10:00:00Z" },
			{ score: 80, timestamp: "2026-05-12T10:00:00Z" },
		];
		const svg = buildTimeline(entries);
		expect(svg).toContain("<svg");
		expect(svg).toContain("<polyline");
		const circles = svg.match(/<circle/g);
		expect(circles).toHaveLength(3);
	});

	it("renders a single entry", () => {
		const svg = buildTimeline([{ score: 90, timestamp: "2026-05-10T10:00:00Z" }]);
		expect(svg).toContain("<circle");
	});
});

describe("buildPyramid", () => {
	it("returns empty for zero test files", () => {
		expect(buildPyramid({ unit: 0, integration: 0, component: 0, e2e: 0 })).toBe("");
	});

	it("renders 4 layers", () => {
		const svg = buildPyramid({ unit: 10, integration: 3, component: 2, e2e: 1 });
		expect(svg).toContain("Unit (10)");
		expect(svg).toContain("E2E (1)");
		const polygons = svg.match(/<polygon/g);
		expect(polygons).toHaveLength(4);
	});

	it("dims empty layers", () => {
		const svg = buildPyramid({ unit: 5, integration: 0, component: 0, e2e: 0 });
		expect(svg).toContain('opacity="0.05"'); // empty layers dimmed (0.2 * 0.25)
		expect(svg).toContain("Unit (5)");
	});
});

describe("buildBadge", () => {
	it("renders shields-style badge SVG", () => {
		const svg = buildBadge(85, "B");
		expect(svg).toContain("vcqa");
		expect(svg).toContain("B 85");
		expect(svg).toContain("#84cc16"); // B grade color
	});

	it("uses red for F grade", () => {
		const svg = buildBadge(20, "F");
		expect(svg).toContain("#ef4444");
	});

	it("uses green for A grade", () => {
		const svg = buildBadge(95, "A");
		expect(svg).toContain("#22c55e");
	});
});
