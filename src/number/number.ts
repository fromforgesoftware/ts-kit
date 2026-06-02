/**
 * Convert a decimal ratio (e.g. 0.588) to a percentage (e.g. 58.8),
 * rounded to one decimal place.
 */
export function toPercent(decimal: number): number {
	return Math.round(decimal * 100 * 10) / 10;
}
