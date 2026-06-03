import { describe, expect, it } from 'vitest';
import { toPercent } from '../../number/index.js';

describe('toPercent', () => {
	it('converts a decimal ratio to a percentage', () => {
		expect(toPercent(0.5)).toBe(50);
		expect(toPercent(1)).toBe(100);
		expect(toPercent(0)).toBe(0);
	});

	it('rounds to one decimal place', () => {
		expect(toPercent(0.588)).toBe(58.8);
		expect(toPercent(0.5885)).toBe(58.9);
		expect(toPercent(0.12345)).toBe(12.3);
	});

	it('handles values above 1', () => {
		expect(toPercent(1.5)).toBe(150);
	});

	it('handles negative ratios', () => {
		expect(toPercent(-0.25)).toBe(-25);
	});
});
