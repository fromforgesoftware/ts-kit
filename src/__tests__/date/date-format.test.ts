import { afterEach, describe, expect, it } from 'vitest';
import {
	EDateFormat,
	EFormatRegion,
	FormatRegionType,
	initializeFormatRegion,
	initializeHourCycleFormat,
	initializeDateLocale,
	getDateLocale,
} from '../../date/index.js';

afterEach(() => {
	// Reset region + hour-cycle providers between tests.
	initializeFormatRegion({ getRegion: () => EFormatRegion.International });
	initializeHourCycleFormat(() => 24);
	initializeDateLocale('en');
});

describe('FormatRegionType', () => {
	it('getValues lists both regions', () => {
		const values = FormatRegionType.getValues();
		expect(values.map((v) => v.id)).toEqual([
			EFormatRegion.International,
			EFormatRegion.US,
		]);
	});

	it('resolve keeps international formats unchanged', () => {
		initializeFormatRegion({ getRegion: () => EFormatRegion.International });
		expect(FormatRegionType.resolve(EDateFormat.Slash)).toBe(EDateFormat.Slash);
	});

	it('resolve maps to the US variant when region is US', () => {
		expect(FormatRegionType.resolve(EDateFormat.Slash, EFormatRegion.US)).toBe(EDateFormat.SlashUS);
		expect(FormatRegionType.resolve(EDateFormat.Pretty, EFormatRegion.US)).toBe(EDateFormat.PrettyUS);
	});

	it('resolve uses the registered region provider when no explicit region is passed', () => {
		initializeFormatRegion({ getRegion: () => EFormatRegion.US });
		expect(FormatRegionType.resolve(EDateFormat.MonthYear)).toBe(EDateFormat.MonthYearUS);
	});

	it('resolve returns the original format when no US variant exists', () => {
		expect(FormatRegionType.resolve(EDateFormat.Default, EFormatRegion.US)).toBe(EDateFormat.Default);
	});

	it('resolve applies 12h hour-cycle token rewriting when registered', () => {
		initializeHourCycleFormat(() => 12);
		expect(FormatRegionType.resolve(EDateFormat.Time)).toBe('h:mm a');
		expect(FormatRegionType.resolve(EDateFormat.TimeFull)).toBe('h:mm:ss a');
		expect(FormatRegionType.resolve(EDateFormat.Full)).toBe('yyyy-MM-dd h:mm:ss a');
	});

	it('resolve leaves 24h tokens intact when hour cycle is 24', () => {
		initializeHourCycleFormat(() => 24);
		expect(FormatRegionType.resolve(EDateFormat.Time)).toBe(EDateFormat.Time);
	});
});

describe('date locale', () => {
	it('defaults to en and is settable', () => {
		expect(getDateLocale()).toBe('en');
		initializeDateLocale('es-ES');
		expect(getDateLocale()).toBe('es-ES');
	});

	it('normalizes underscore locale tags to hyphenated BCP 47', () => {
		initializeDateLocale('es_ES');
		expect(getDateLocale()).toBe('es-ES');
	});
});
