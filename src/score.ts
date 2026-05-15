/** Compute weighted composite score from individual check results. */

import type { CheckResult } from "./types.js";

const WEIGHTS: Record<string, number> = {
	lint: 15,
	types: 15,
	tests: 20,
	coverage: 15,
	complexity: 10,
	dependencies: 15,
	secrets: 10,
};

export function computeScore(checks: CheckResult[]): number {
	let totalWeight = 0;
	let weightedSum = 0;

	for (const check of checks) {
		if ((check.details as any).skipped) continue;
		const weight = WEIGHTS[check.name] || 10;
		totalWeight += weight;
		weightedSum += check.score * weight;
	}

	return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
}
