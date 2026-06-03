import { afterEach, describe, expect, it } from 'vitest';
import {
	setTimezoneProvider,
	getOrgTimezone,
	getBrowserTimezone,
	setHourCycleProvider,
	getHourCycle,
	setWeekStartProvider,
	getWeekStart,
	getWeekStartForCalendar,
	setFormatResolver,
	resolveFormat,
	getTimeFormat,
} from '../../date/index.js';

afterEach(() => {
	// Restore module-level providers to their documented defaults.
	setTimezoneProvider(() => 'UTC');
	setHourCycleProvider(() => 24);
	setWeekStartProvider(() => 1);
	setFormatResolver((f) => f);
});

describe('date/config providers', () => {
	it('timezone provider defaults to UTC and is settable', () => {
		expect(getOrgTimezone()).toBe('UTC');
		setTimezoneProvider(() => 'Europe/Madrid');
		expect(getOrgTimezone()).toBe('Europe/Madrid');
	});

	it('getBrowserTimezone returns the resolved IANA zone', () => {
		expect(typeof getBrowserTimezone()).toBe('string');
		expect(getBrowserTimezone().length).toBeGreaterThan(0);
	});

	it('hour cycle defaults to 24 and is settable', () => {
		expect(getHourCycle()).toBe(24);
		setHourCycleProvider(() => 12);
		expect(getHourCycle()).toBe(12);
	});

	it('week start defaults to ISO Monday (1)', () => {
		expect(getWeekStart()).toBe(1);
		setWeekStartProvider(() => 7);
		expect(getWeekStart()).toBe(7);
	});

	it('getWeekStartForCalendar maps ISO Sunday (7) to 0', () => {
		setWeekStartProvider(() => 7);
		expect(getWeekStartForCalendar()).toBe(0);
		setWeekStartProvider(() => 1);
		expect(getWeekStartForCalendar()).toBe(1);
	});

	it('format resolver is identity by default and overridable', () => {
		expect(resolveFormat('dd/MM/yyyy')).toBe('dd/MM/yyyy');
		setFormatResolver((f) => `RESOLVED:${f}`);
		expect(resolveFormat('x')).toBe('RESOLVED:x');
	});

	it('getTimeFormat reflects the hour cycle', () => {
		setHourCycleProvider(() => 24);
		expect(getTimeFormat()).toBe('HH:mm');
		setHourCycleProvider(() => 12);
		expect(getTimeFormat()).toBe('h:mm a');
	});
});
