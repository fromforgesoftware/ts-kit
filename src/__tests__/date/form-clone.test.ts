import { describe, expect, it } from 'vitest';
import {
	cloneFormStateWithForgeDate,
	serializeFormStateWithForgeDate,
	ForgeDate,
} from '../../date/index.js';

describe('cloneFormStateWithForgeDate', () => {
	it('returns null/undefined unchanged', () => {
		expect(cloneFormStateWithForgeDate(null)).toBeNull();
		expect(cloneFormStateWithForgeDate(undefined)).toBeUndefined();
	});

	it('returns primitives unchanged', () => {
		expect(cloneFormStateWithForgeDate(5)).toBe(5);
		expect(cloneFormStateWithForgeDate('s')).toBe('s');
		expect(cloneFormStateWithForgeDate(true)).toBe(true);
	});

	it('clones a ForgeDate into a new equal instance', () => {
		const original = ForgeDate.fromISO('2024-03-15T08:30:00Z');
		const cloned = cloneFormStateWithForgeDate(original);
		expect(cloned).toBeInstanceOf(ForgeDate);
		expect(cloned).not.toBe(original);
		expect(cloned.toISO()).toBe(original.toISO());
	});

	it('deep-clones arrays and nested objects preserving ForgeDate', () => {
		const startsAt = ForgeDate.fromISO('2024-01-01T00:00:00Z');
		const state = {
			title: 'x',
			tags: ['a', 'b'],
			window: { startsAt, count: 3 },
		};
		const cloned = cloneFormStateWithForgeDate(state);
		expect(cloned).not.toBe(state);
		expect(cloned.tags).not.toBe(state.tags);
		expect(cloned.window).not.toBe(state.window);
		expect(cloned.window.startsAt).toBeInstanceOf(ForgeDate);
		expect(cloned.window.startsAt).not.toBe(startsAt);
		expect(cloned.window.startsAt.toISO()).toBe(startsAt.toISO());
		expect(cloned.title).toBe('x');
	});

	it('returns functions as-is', () => {
		const fn = () => 1;
		expect(cloneFormStateWithForgeDate(fn)).toBe(fn);
	});
});

describe('serializeFormStateWithForgeDate', () => {
	it('replaces ForgeDate with its ISO string', () => {
		const startsAt = ForgeDate.fromISO('2024-03-15T08:30:00Z');
		const json = serializeFormStateWithForgeDate({ startsAt, name: 'shift' });
		expect(json).toContain('2024-03-15T08:30:00.000Z');
		expect(json).toContain('shift');
	});

	it('produces a stable string for equal-valued dates', () => {
		const a = { d: ForgeDate.fromISO('2024-03-15T08:30:00Z') };
		const b = { d: ForgeDate.fromISO('2024-03-15T08:30:00Z') };
		expect(serializeFormStateWithForgeDate(a)).toBe(serializeFormStateWithForgeDate(b));
	});
});
