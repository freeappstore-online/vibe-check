/** Compute weighted composite score from individual check results. */

import type { CheckResult } from "./types.js";

const WEIGHTS: Record<string, number> = {
	structure: 8,
	lint: 10,
	types: 10,
	"type-safety": 7,
	complexity: 8,
	duplication: 5,
	docs: 5,
	secrets: 7,
	dependencies: 10,
	testing: 30, // testing is the single most important dimension
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
