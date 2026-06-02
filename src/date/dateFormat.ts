export enum EDateFormat {
	Default = 'yyyy-MM-dd',
	Slash = 'dd/MM/yyyy',
	SlashUS = 'MM/dd/yyyy',
	Days = 'dd',
	Hours = 'HH',
	Time = 'HH:mm',
	TimeFull = 'HH:mm:ss',
	TimeAMPM = 'h:mm a',
	Month = 'MM',
	MonthShort = 'LLL',
	MonthFull = 'MMMM',
	WeekdayShort = 'ccc',
	WeekdayFull = 'cccc',
	YearFull = 'yyyy',

	PrettyFull = 'dd LLL yyyy, HH:mm',
	PrettyFullUS = 'LLL dd, yyyy, HH:mm',
	PrettyShort = 'dd LLL yy',
	PrettyShortUS = 'LLL dd, yy',

	PrettyDayMonthYear = 'ccc, d MMM yyyy',
	PrettyDayMonthYearUS = 'ccc, MMM d, yyyy',
	PrettyDayMonthYearShort = 'ccc, d MMM yy',
	PrettyDayMonthYearShortUS = 'ccc, MMM d, yy',
	PrettyDayMonth = 'ccc, d MMM ',
	PrettyDayMonthUS = 'ccc, MMM d',
	PrettyMonthDay = 'd LLL',
	PrettyMonthDayUS = 'LLL d',
	DayMonth = 'd MMM ',
	DayMonthUS = 'MMM d',
	DayWeekShort = 'ccc dd',
	DayWeekMonth = 'ccc, d MMM',
	DayWeekMonthUS = 'ccc, MMM d',
	MonthYear = 'MMMM yyyy',
	MonthYearUS = 'MMMM yyyy',
	Pretty = 'dd LLL yyyy',
	PrettyUS = 'LLL dd, yyyy',
	DayTime = 'yyyy-MM-dd HH:mm',
	Full = 'yyyy-MM-dd HH:mm:ss',
}

export enum EFormatRegion {
	International = 'Europe',
	US = 'USA',
}

export interface IRegionProvider {
	getRegion(): EFormatRegion;
}

// Mapping from international formats to their US equivalents
const usFormatMap: Record<string, EDateFormat> = {
	[EDateFormat.Slash]: EDateFormat.SlashUS,
	[EDateFormat.Pretty]: EDateFormat.PrettyUS,
	[EDateFormat.PrettyFull]: EDateFormat.PrettyFullUS,
	[EDateFormat.PrettyShort]: EDateFormat.PrettyShortUS,
	[EDateFormat.PrettyDayMonthYear]: EDateFormat.PrettyDayMonthYearUS,
	[EDateFormat.PrettyDayMonthYearShort]: EDateFormat.PrettyDayMonthYearShortUS,
	[EDateFormat.PrettyDayMonth]: EDateFormat.PrettyDayMonthUS,
	[EDateFormat.PrettyMonthDay]: EDateFormat.PrettyMonthDayUS,
	[EDateFormat.DayMonth]: EDateFormat.DayMonthUS,
	[EDateFormat.DayWeekMonth]: EDateFormat.DayWeekMonthUS,
	[EDateFormat.MonthYear]: EDateFormat.MonthYearUS,
};

let regionProvider: IRegionProvider | null = null;

/**
 * Initializes the format region provider.
 * Must be called during app initialization before using resolve() without explicit region.
 */
export function initializeFormatRegion(provider: IRegionProvider): void {
	regionProvider = provider;
}

// ── Locale support for date formatting ──────────────────────────────

let dateLocale: string = 'en';

/**
 * Sets the locale used by ForgeDate.format() for locale-aware tokens
 * (e.g., MMMM -> "marzo", ccc -> "lun").
 * Must be called during app initialization and whenever the locale changes.
 */
export function initializeDateLocale(locale: string): void {
	// Luxon requires BCP 47 tags with hyphens (e.g. "es-ES"), not underscores ("es_ES")
	dateLocale = locale.replace(/_/g, '-');
}

/**
 * Returns the current date formatting locale.
 */
export function getDateLocale(): string {
	return dateLocale;
}

export class FormatRegionType {
	static getValues(): { id: EFormatRegion; value: string }[] {
		return [
			{
				id: EFormatRegion.International,
				value: 'International (dd/MM/yyyy)',
			},
			{
				id: EFormatRegion.US,
				value: 'US (MM/dd/yyyy)',
			},
		];
	}

	/**
	 * Resolves a date format string to the correct regional variant,
	 * then applies hour cycle preference (12h/24h) if a provider is registered.
	 * If region is not provided, uses the registered region provider.
	 * Returns the original format if no regional variant exists (e.g., ISO formats, time-only).
	 * Falls back to international (original format) if region is not US.
	 */
	static resolve(format: EDateFormat, region?: EFormatRegion): EDateFormat {
		const actualRegion = region ?? regionProvider?.getRegion() ?? EFormatRegion.International;
		let resolved = format;
		if (actualRegion === EFormatRegion.US) {
			resolved = usFormatMap[format] ?? format;
		}
		if (hourCycleProvider?.() === 12) {
			resolved = applyHourCycle12(resolved);
		}
		return resolved;
	}
}

// ── Hour cycle support ──────────────────────────────────────────────

let hourCycleProvider: (() => 12 | 24) | null = null;

/**
 * Registers the hour cycle provider so FormatRegionType.resolve()
 * can apply 12h/24h formatting automatically.
 */
export function initializeHourCycleFormat(provider: () => 12 | 24): void {
	hourCycleProvider = provider;
}

/**
 * Replaces 24h time tokens with 12h equivalents in a Luxon format string.
 */
function applyHourCycle12(format: EDateFormat): EDateFormat {
	// Replace HH:mm:ss → h:mm:ss a, HH:mm → h:mm a, HH → h a
	return format
		.replace('HH:mm:ss', 'h:mm:ss a')
		.replace('HH:mm', 'h:mm a')
		.replace('HH', 'h a') as EDateFormat;
}
