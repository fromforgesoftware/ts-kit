/**
 * Timezone provider for organization-specific date formatting.
 * Set during app initialization.
 */
let timezoneProvider: () => string = () => 'UTC';

export function setTimezoneProvider(provider: () => string): void {
	timezoneProvider = provider;
}

export function getOrgTimezone(): string {
	return timezoneProvider();
}

/**
 * Returns the browser's IANA timezone (e.g. "Europe/London").
 */
export function getBrowserTimezone(): string {
	return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Hour cycle provider for 12h/24h time format preference.
 * Set during app initialization from the customer preference.
 */
let hourCycleProvider: () => 12 | 24 = () => 24;

export function setHourCycleProvider(provider: () => 12 | 24): void {
	hourCycleProvider = provider;
}

export function getHourCycle(): 12 | 24 {
	return hourCycleProvider();
}

/**
 * Week start provider for calendar components.
 * Uses ISO weekday numbering: 1=Monday, ..., 7=Sunday.
 * Set during app initialization from the account preference.
 */
let weekStartProvider: () => number = () => 1;

export function setWeekStartProvider(provider: () => number): void {
	weekStartProvider = provider;
}

export function getWeekStart(): number {
	return weekStartProvider();
}

/**
 * Maps ISO week start (1-7) to reka-ui calendar convention (0-6).
 * ISO: 1=Mon,...,7=Sun → reka-ui: 0=Sun,1=Mon,...,6=Sat
 */
export function getWeekStartForCalendar(): 0 | 1 | 2 | 3 | 4 | 5 | 6 {
	const ws = weekStartProvider();
	return (ws === 7 ? 0 : ws) as 0 | 1 | 2 | 3 | 4 | 5 | 6;
}

/**
 * Format resolver for regional date formats.
 * Delegates to FormatRegionType.resolve when a resolver is registered.
 */
let formatResolver: (format: string) => string = (f) => f;

export function setFormatResolver(resolver: (format: string) => string): void {
	formatResolver = resolver;
}

export function resolveFormat(format: string): string {
	return formatResolver(format);
}

/**
 * Returns the appropriate time format string based on the current hour cycle preference.
 * 24h → 'HH:mm', 12h → 'h:mm a'
 */
export function getTimeFormat(): string {
	return getHourCycle() === 12 ? 'h:mm a' : 'HH:mm';
}
