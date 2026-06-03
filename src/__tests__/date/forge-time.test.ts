import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ForgeTime, ForgeDate, setHourCycleProvider, setFormatResolver } from '../../date/index.js';

beforeEach(() => {
	setHourCycleProvider(() => 24);
	setFormatResolver((f) => f);
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('ForgeTime string operations', () => {
	it('format reformats a time string', () => {
		expect(ForgeTime.format('08:30', 'HH:mm:ss')).toBe('08:30:00');
		expect(ForgeTime.format('08:30:45', 'HH:mm')).toBe('08:30');
	});

	it('format throws for an unrecognized part count', () => {
		expect(() => ForgeTime.format('08:30:45:12:99', 'HH:mm')).toThrow(/Invalid time format/);
	});

	it('format warns and echoes the input for an invalid time', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
		expect(ForgeTime.format('99:99', 'HH:mm')).toBe('99:99');
		expect(warn).toHaveBeenCalled();
	});

	it('secondsSinceMidnight', () => {
		expect(ForgeTime.secondsSinceMidnight('01:01')).toBe(3660);
		expect(() => ForgeTime.secondsSinceMidnight('bad')).toThrow(/secondsSinceMidnight/);
	});

	it('removeMillis strips a trailing millisecond component', () => {
		expect(ForgeTime.removeMillis('10:30:45.123')).toBe('10:30:45');
		expect(ForgeTime.removeMillis('10:30:45')).toBe('10:30:45');
	});

	it('toSeconds parses an ISO time duration', () => {
		expect(ForgeTime.toSeconds('01:00')).toBe(3600);
		expect(ForgeTime.toSeconds('00:01:30')).toBe(90);
	});

	it('toDate parses a formatted string into a ForgeDate', () => {
		const fd = ForgeTime.toDate('15/03/2024', 'dd/MM/yyyy');
		expect(fd).toBeInstanceOf(ForgeDate);
		expect(fd.year).toBe(2024);
		expect(() => ForgeTime.toDate('bad', 'dd/MM/yyyy')).toThrow(/Invalid date/);
	});

	it('formatDate reformats with input and output formats', () => {
		expect(ForgeTime.formatDate('2024-03-15', 'dd/MM/yyyy')).toBe('15/03/2024');
	});

	it('formatDate returns fallback on parse failure', () => {
		expect(ForgeTime.formatDate('bad', 'dd/MM/yyyy')).toBe('-');
		expect(ForgeTime.formatDate('bad', 'dd/MM/yyyy', 'yyyy-MM-dd', 'N/A')).toBe('N/A');
	});

	it('setTime combines a time string with a source date', () => {
		const src = ForgeDate.fromDate(new Date(2024, 0, 1, 0, 0, 0));
		const out = ForgeTime.setTime('09:30', src, 'HH:mm');
		expect(out.hour).toBe(9);
		expect(out.minute).toBe(30);
		expect(() => ForgeTime.setTime('bad', src, 'HH:mm')).toThrow(/Invalid time/);
	});
});

describe('ForgeTime number operations', () => {
	it('fromSeconds 24h format', () => {
		expect(ForgeTime.fromSeconds(3661, 'HH:mm:ss')).toBe('01:01:01');
	});

	it('fromSeconds 12h format with AM/PM', () => {
		expect(ForgeTime.fromSeconds(13 * 3600, 'hh:mm A')).toBe('01:00 PM');
		expect(ForgeTime.fromSeconds(0, 'hh:mm a')).toBe('12:00 am');
	});

	it('formatHours zero-pads and wraps at 24', () => {
		expect(ForgeTime.formatHours(9)).toBe('09');
		expect(ForgeTime.formatHours(25)).toBe('01');
	});

	it('secToMin with and without rounding', () => {
		expect(ForgeTime.secToMin(90)).toBe(1.5);
		expect(ForgeTime.secToMin(100, 1)).toBe(1.7);
	});

	it('durationToTime full and compact', () => {
		expect(ForgeTime.durationToTime(90061)).toBe('1d 1h 1m');
		expect(ForgeTime.durationToTime(90061, true)).toBe('1d');
		expect(ForgeTime.durationToTime(3700, true)).toBe('1h');
		expect(ForgeTime.durationToTime(120, true)).toBe('2m');
		expect(ForgeTime.durationToTime(0)).toBe('0m');
	});

	it('durationToHours', () => {
		expect(ForgeTime.durationToHours(7200)).toBe('2');
	});

	it('formatDuration (ms) short and long', () => {
		expect(ForgeTime.formatDuration(3_661_000)).toBe('1h 1m 1s');
		expect(ForgeTime.formatDuration(3_661_000, 'long')).toBe('1 hour 1 minute 1 second');
		expect(ForgeTime.formatDuration(-5)).toBe('0s');
		expect(ForgeTime.formatDuration(-5, 'long')).toBe('0 seconds');
		expect(ForgeTime.formatDuration(0)).toBe('0s');
	});

	it('formatDuration pluralizes correctly', () => {
		expect(ForgeTime.formatDuration(7_200_000, 'long')).toBe('2 hours');
		expect(ForgeTime.formatDuration(120_000, 'long')).toBe('2 minutes');
	});

	it('formatDurationSec short and long', () => {
		expect(ForgeTime.formatDurationSec(3661)).toBe('1h 1m 1s');
		expect(ForgeTime.formatDurationSec(3661, 'long')).toBe('1 hour 1 minute 1 second');
		expect(ForgeTime.formatDurationSec(-1)).toBe('0s');
		expect(ForgeTime.formatDurationSec(-1, 'long')).toBe('0 seconds');
	});

	it('toMinutesSeconds', () => {
		expect(ForgeTime.toMinutesSeconds(45)).toBe('45s');
		expect(ForgeTime.toMinutesSeconds(60)).toBe('1m');
		expect(ForgeTime.toMinutesSeconds(90)).toBe('1m 30s');
	});
});

describe('ForgeTime display-format (hour-cycle aware)', () => {
	it('formatTimeOfDay in 24h and 12h, with wrap past 24h', () => {
		setHourCycleProvider(() => 24);
		expect(ForgeTime.formatTimeOfDay(13 * 3600)).toBe('13:00');
		expect(ForgeTime.formatTimeOfDay(30 * 3600)).toBe('06:00'); // wraps
		setHourCycleProvider(() => 12);
		expect(ForgeTime.formatTimeOfDay(13 * 3600)).toBe('1:00 PM');
		expect(ForgeTime.formatTimeOfDay(0)).toBe('12:00 AM');
	});

	it('formatTimeOfDayShort in 24h and 12h', () => {
		setHourCycleProvider(() => 24);
		expect(ForgeTime.formatTimeOfDayShort(14 * 3600)).toBe('14');
		expect(ForgeTime.formatTimeOfDayShort(26 * 3600)).toBe('2'); // wraps
		setHourCycleProvider(() => 12);
		expect(ForgeTime.formatTimeOfDayShort(14 * 3600)).toBe('2 PM');
		expect(ForgeTime.formatTimeOfDayShort(0)).toBe('12 AM');
	});

	it('endTime adds a duration to a start time', () => {
		setHourCycleProvider(() => 24);
		expect(ForgeTime.endTime('09:00', 8 * 3600)).toBe('17:00');
	});

	it('formatTimeRange', () => {
		setHourCycleProvider(() => 24);
		expect(ForgeTime.formatTimeRange('09:00', 8 * 3600)).toBe('09:00 – 17:00');
		expect(ForgeTime.formatTimeRange('', 100)).toBe('');
	});

	it('formatSecRange', () => {
		setHourCycleProvider(() => 24);
		expect(ForgeTime.formatSecRange(9 * 3600, 17 * 3600)).toBe('09:00 – 17:00');
	});

	it('minutesToTime wraps at 24h', () => {
		expect(ForgeTime.minutesToTime(90)).toBe('01:30');
		expect(ForgeTime.minutesToTime(1500)).toBe('01:00'); // 25h wraps to 1h
		expect(ForgeTime.minutesToTime(-30)).toBe('23:30');
	});
});
