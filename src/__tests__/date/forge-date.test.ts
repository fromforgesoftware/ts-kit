import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	ForgeDate,
	EDateFormat,
	EFormatRegion,
	initializeFormatRegion,
	initializeHourCycleFormat,
	initializeDateLocale,
	setWeekStartProvider,
	setTimezoneProvider,
} from '../../date/index.js';

beforeEach(() => {
	initializeFormatRegion({ getRegion: () => EFormatRegion.International });
	initializeHourCycleFormat(() => 24);
	initializeDateLocale('en');
	setWeekStartProvider(() => 1);
	setTimezoneProvider(() => 'UTC');
});

afterEach(() => {
	vi.useRealTimers();
});

describe('ForgeDate construction', () => {
	it('now() / no-arg builds a valid current date', () => {
		expect(ForgeDate.now().isValid()).toBe(true);
		expect(new ForgeDate().isValid()).toBe(true);
	});

	it('builds from a Date (defensive copy)', () => {
		const d = new Date('2024-01-15T10:00:00Z');
		const fd = ForgeDate.fromDate(d);
		d.setFullYear(1999);
		expect(fd.year).toBe(2024);
	});

	it('builds from millis', () => {
		const fd = ForgeDate.fromMillis(0);
		expect(fd.toMillis()).toBe(0);
	});

	it('builds from an ISO string', () => {
		const fd = ForgeDate.fromISO('2024-03-10T08:30:00Z');
		expect(fd.year).toBe(2024);
		expect(fd.month).toBe(3);
	});

	it('throws on an invalid ISO string', () => {
		expect(() => new ForgeDate('not-a-date')).toThrow(/Invalid date string/);
	});

	it('fromDateString parses a native-Date-parseable string', () => {
		expect(ForgeDate.fromDateString('2024-06-01T00:00:00Z').year).toBe(2024);
		expect(() => ForgeDate.fromDateString('garbage')).toThrow(/Invalid date string/);
	});

	it('fromString parses with an explicit format', () => {
		const fd = ForgeDate.fromString('15/03/2024', EDateFormat.Slash);
		expect(fd.day).toBe(15);
		expect(fd.month).toBe(3);
		expect(() => ForgeDate.fromString('nope', EDateFormat.Slash)).toThrow(/Invalid date string/);
	});

	it('fromTime strips trailing millis before parsing', () => {
		const fd = ForgeDate.fromTime('08:30.123');
		expect(fd.hour).toBe(8);
		expect(fd.minute).toBe(30);
	});

	it('parse returns fallback (or now) on invalid input', () => {
		const fallback = ForgeDate.fromISO('2000-01-01T00:00:00Z');
		expect(ForgeDate.parse('garbage', fallback).year).toBe(2000);
		expect(ForgeDate.parse('garbage').isValid()).toBe(true);
		expect(ForgeDate.parse('2024-05-05T00:00:00Z').year).toBe(2024);
	});

	it('throws on an unsupported input type', () => {
		expect(() => new ForgeDate({} as never)).toThrow(/Invalid input type/);
	});
});

describe('ForgeDate min/max', () => {
	const a = ForgeDate.fromISO('2024-01-01T00:00:00Z');
	const b = ForgeDate.fromISO('2024-06-01T00:00:00Z');
	const c = ForgeDate.fromISO('2024-12-01T00:00:00Z');

	it('min returns the earliest', () => {
		expect(ForgeDate.min(b, a, c).toISO()).toBe(a.toISO());
	});
	it('max returns the latest', () => {
		expect(ForgeDate.max(b, a, c).toISO()).toBe(c.toISO());
	});
	it('throws when no dates are passed', () => {
		expect(() => ForgeDate.min()).toThrow(/At least one date/);
		expect(() => ForgeDate.max()).toThrow(/At least one date/);
	});
});

describe('ForgeDate component getters', () => {
	it('exposes Y/M/D h/m/s/ms and weekday', () => {
		const fd = ForgeDate.fromISO('2024-03-15T13:45:30.250Z').toUTC();
		// org tz == browser handled via UTC provider equality in many CI zones;
		// assert against the underlying date components directly.
		const d = new Date('2024-03-15T13:45:30.250Z');
		const local = ForgeDate.fromDate(d);
		expect(local.year).toBe(d.getFullYear());
		expect(local.month).toBe(d.getMonth() + 1);
		expect(local.day).toBe(d.getDate());
		expect(local.hour).toBe(d.getHours());
		expect(local.minute).toBe(d.getMinutes());
		expect(local.second).toBe(d.getSeconds());
		expect(local.millisecond).toBe(d.getMilliseconds());
		expect(local.weekday).toBeGreaterThanOrEqual(1);
		expect(local.weekday).toBeLessThanOrEqual(7);
		expect(fd.isValid()).toBe(true);
	});

	it('daysInMonth', () => {
		expect(ForgeDate.fromISO('2024-02-10T00:00:00Z').daysInMonth()).toBe(29); // leap year
		expect(ForgeDate.fromISO('2023-02-10T00:00:00Z').daysInMonth()).toBe(28);
	});
});

describe('ForgeDate arithmetic', () => {
	const base = ForgeDate.fromISO('2024-01-15T12:00:00Z');

	it('plus/minus durations', () => {
		expect(base.plus({ days: 1 }).diffSigned(base, 'days')).toBeCloseTo(1, 5);
		expect(base.minus({ hours: 2 }).diffSigned(base, 'hours')).toBeCloseTo(-2, 5);
	});

	it('diff is absolute, diffSigned keeps sign', () => {
		const later = base.plus({ hours: 5 });
		expect(base.diff(later, 'hours')).toBeCloseTo(5, 5);
		expect(base.diffSigned(later, 'hours')).toBeCloseTo(-5, 5);
		expect(later.diffSigned(base, 'hours')).toBeCloseTo(5, 5);
	});

	it('start/end of day', () => {
		const d = ForgeDate.fromISO('2024-01-15T12:34:56Z');
		const start = d.startOf('day');
		expect(start.hour).toBe(0);
		expect(start.minute).toBe(0);
		const end = d.endOf('day');
		expect(end.hour).toBe(23);
		expect(end.minute).toBe(59);
	});

	it('start of week honours the week-start preference', () => {
		// 2024-01-17 is a Wednesday.
		const wed = ForgeDate.fromDate(new Date(2024, 0, 17, 10, 0, 0));
		setWeekStartProvider(() => 1); // Monday
		const monStart = wed.startOf('week');
		expect(monStart.toDate().getDay()).toBe(1); // Monday
		setWeekStartProvider(() => 7); // Sunday
		const sunStart = wed.startOf('week');
		expect(sunStart.toDate().getDay()).toBe(0); // Sunday
	});

	it('end of week is 6 days after the week start', () => {
		const wed = ForgeDate.fromDate(new Date(2024, 0, 17, 10, 0, 0));
		setWeekStartProvider(() => 1);
		const start = wed.startOf('week');
		const end = wed.endOf('week');
		// end-of-week is end-of-day on the 6th day after the week start, so the
		// span is just under 7 full days (6 days + 23:59:59.999).
		expect(Math.floor(end.diffSigned(start, 'days'))).toBe(6);
		expect(end.diffSigned(start, 'days')).toBeLessThan(7);
	});

	it('start/end of month and year', () => {
		const d = ForgeDate.fromDate(new Date(2024, 5, 15, 10, 0, 0));
		expect(d.startOf('month').day).toBe(1);
		expect(d.startOf('year').month).toBe(1);
		expect(d.endOf('month').day).toBe(30); // June
	});

	it('changeToDate keeps this time but the target calendar day', () => {
		const time = ForgeDate.fromDate(new Date(2024, 0, 1, 8, 30, 0));
		const target = ForgeDate.fromDate(new Date(2025, 5, 20, 0, 0, 0));
		const moved = time.changeToDate(target);
		expect(moved.year).toBe(2025);
		expect(moved.month).toBe(6);
		expect(moved.day).toBe(20);
		expect(moved.hour).toBe(8);
		expect(moved.minute).toBe(30);
	});

	it('setHourMinute sets time and zeroes seconds', () => {
		const d = ForgeDate.fromDate(new Date(2024, 0, 1, 1, 1, 59));
		const updated = d.setHourMinute(14, 5);
		expect(updated.hour).toBe(14);
		expect(updated.minute).toBe(5);
		expect(updated.second).toBe(0);
	});

	it('withTime applies an HH:mm or HH:mm:ss string', () => {
		const d = ForgeDate.fromDate(new Date(2024, 0, 1, 0, 0, 0));
		expect(d.withTime('09:30').hour).toBe(9);
		expect(d.withTime('09:30').minute).toBe(30);
		expect(d.withTime('09:30:45').second).toBe(45);
		expect(() => d.withTime('99:99')).toThrow(/Invalid time/);
	});
});

describe('ForgeDate comparisons', () => {
	const early = ForgeDate.fromISO('2024-01-01T00:00:00Z');
	const late = ForgeDate.fromISO('2024-12-31T00:00:00Z');

	it('isBefore / isAfter', () => {
		expect(early.isBefore(late)).toBe(true);
		expect(late.isAfter(early)).toBe(true);
		expect(early.isAfter(late)).toBe(false);
	});

	it('isSame by unit', () => {
		const a = ForgeDate.fromDate(new Date(2024, 0, 1, 8, 0, 0));
		const b = ForgeDate.fromDate(new Date(2024, 0, 1, 20, 0, 0));
		expect(a.isSame(b, 'day')).toBe(true);
		expect(a.isSame(b, 'hour')).toBe(false);
	});

	it('isBetween is inclusive', () => {
		const mid = ForgeDate.fromISO('2024-06-01T00:00:00Z');
		expect(mid.isBetween(early, late)).toBe(true);
		expect(early.isBetween(early, late)).toBe(true);
		expect(ForgeDate.fromISO('2025-01-01T00:00:00Z').isBetween(early, late)).toBe(false);
	});
});

describe('ForgeDate conversions', () => {
	const fd = ForgeDate.fromISO('2024-03-15T13:45:30Z');

	it('toDate returns a fresh Date', () => {
		const d = fd.toDate();
		expect(d).toBeInstanceOf(Date);
		d.setFullYear(1900);
		expect(fd.year).toBe(2024);
	});

	it('toISO / toISODate / toISOTime', () => {
		expect(fd.toISO()).toBe('2024-03-15T13:45:30.000Z');
		expect(fd.toISODate()).toBe('2024-03-15');
		expect(fd.toISOTime()).toBe('13:45:30');
	});

	it('invalid dates serialize to empty strings instead of throwing', () => {
		const bad = ForgeDate.fromMillis(NaN);
		expect(bad.isValid()).toBe(false);
		expect(bad.toISO()).toBe('');
		expect(bad.toISODate()).toBe('');
		expect(bad.toISOTime()).toBe('');
	});

	it('toMillis / valueOf agree', () => {
		expect(fd.valueOf()).toBe(fd.toMillis());
	});
});

describe('ForgeDate formatting', () => {
	it('format capitalizes each word', () => {
		const fd = ForgeDate.fromDate(new Date(2024, 0, 5, 0, 0, 0));
		// MonthShort -> "Jan" (already capitalized); use a multi-word format.
		const out = fd.format(EDateFormat.DayWeekMonth);
		// Each space-separated word is capitalized.
		out.split(' ').forEach((w) => {
			if (w.length) expect(w[0]).toBe(w[0].toUpperCase());
		});
	});

	it('format defaults to ISO date format', () => {
		const fd = ForgeDate.fromDate(new Date(2024, 2, 9, 0, 0, 0));
		expect(fd.format()).toBe('2024-03-09');
	});

	it('format throws on an invalid date', () => {
		expect(() => ForgeDate.fromMillis(NaN).format()).toThrow(/Invalid date/);
	});

	it('formatInTz formats in the org timezone', () => {
		setTimezoneProvider(() => 'UTC');
		const fd = ForgeDate.fromISO('2024-03-15T13:45:00Z');
		expect(fd.formatInTz(EDateFormat.Time)).toBe('13:45');
	});

	it('weekdayLong / weekdayShort', () => {
		// 2024-01-15 is a Monday.
		const mon = ForgeDate.fromDate(new Date(2024, 0, 15, 12, 0, 0));
		expect(mon.weekdayLong()).toBe('Monday');
		expect(mon.weekdayShort()).toBe('Mon');
	});

	it('toRelative returns a human string', () => {
		const fd = ForgeDate.now().minus({ days: 2 });
		expect(typeof fd.toRelative()).toBe('string');
	});
});

describe('ForgeDate relative helpers', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2024-06-15T12:00:00Z'));
	});

	it('formatRelativePast buckets by age', () => {
		const now = ForgeDate.now();
		expect(now.formatRelativePast()).toBe('today');
		expect(now.minus({ days: 1 }).formatRelativePast()).toBe('yesterday');
		expect(now.minus({ days: 3 }).formatRelativePast()).toBe('3d ago');
		expect(now.minus({ days: 10 }).formatRelativePast()).toBe('1w ago');
		expect(now.minus({ days: 60 }).formatRelativePast()).toBe('2mo ago');
		expect(now.minus({ days: 800 }).formatRelativePast()).toBe('2y ago');
	});

	it('formatRelativePast collapses future dates to today', () => {
		expect(ForgeDate.now().plus({ days: 5 }).formatRelativePast()).toBe('today');
	});

	it('formatRelativePast returns empty for invalid dates', () => {
		expect(ForgeDate.fromMillis(NaN).formatRelativePast()).toBe('');
	});

	it('formatRelativeFuture buckets by lead time', () => {
		const now = ForgeDate.now();
		expect(now.minus({ days: 1 }).formatRelativeFuture()).toBe('soon');
		expect(now.plus({ minutes: 30 }).formatRelativeFuture()).toBe('in <1h');
		expect(now.plus({ hours: 3 }).formatRelativeFuture()).toBe('in 3h');
		expect(now.plus({ days: 2 }).formatRelativeFuture()).toBe('in 2d');
	});

	it('formatRelativeFuture returns empty for invalid dates', () => {
		expect(ForgeDate.fromMillis(NaN).formatRelativeFuture()).toBe('');
	});
});

describe('ForgeDate timezone conversion (org == browser short-circuit)', () => {
	it('toUTC/fromUTC are no-ops when org tz equals browser tz', () => {
		setTimezoneProvider(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
		const fd = ForgeDate.fromISO('2024-03-15T13:45:00Z');
		expect(fd.toUTC().toISO()).toBe(fd.toISO());
		expect(fd.fromUTC().toISO()).toBe(fd.toISO());
		expect(fd.toTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone).toISO()).toBe(fd.toISO());
	});

	it('nowInTz returns a valid date', () => {
		expect(ForgeDate.nowInTz().isValid()).toBe(true);
	});
});
