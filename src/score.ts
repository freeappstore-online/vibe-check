/** Compute weighted composite score from individual check results. */

import type { CheckResult } from "./types.js";

const WEIGHTS: Record<string, number> = {
	// Foundations (25%)
	structure: 5,
	lint: 7,
	types: 6,
	"type-safety": 4,
	standards: 3,
	// Quality (20%)
	complexity: 8,
	duplication: 5,
	docs: 3,
	// Testing (30%)
	testing: 30,
	// Security (25%)
	secrets: 7,
	security: 8,
	dependencies: 9,
};

export function computeScore(checks: CheckResult[]): number {
	let totalWeight = 0;
	let weightedSum = 0;

	for (const check of checks) {
		if ((check.details as Record<string, unknown>).skipped) continue;
		const weight = WEIGHTS[check.name] || 5;
		totalWeight += weight;
		weightedSum += check.score * weight;
	}

	return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
}
