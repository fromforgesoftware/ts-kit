import { DateTime } from 'luxon';
import { EDateFormat, FormatRegionType, getDateLocale } from './dateFormat';
import { getOrgTimezone, getBrowserTimezone, getWeekStartForCalendar } from './config';

export interface DurationInput {
	years?: number;
	months?: number;
	days?: number;
	hours?: number;
	minutes?: number;
	seconds?: number;
}

const weekDayLongMap: Record<string, string> = {
	monday: 'Monday',
	tuesday: 'Tuesday',
	wednesday: 'Wednesday',
	thursday: 'Thursday',
	friday: 'Friday',
	saturday: 'Saturday',
	sunday: 'Sunday',
};

const weekDayShortMap: Record<string, string> = {
	mon: 'Mon',
	tue: 'Tue',
	wed: 'Wed',
	thu: 'Thu',
	fri: 'Fri',
	sat: 'Sat',
	sun: 'Sun',
};

export class ForgeDate {
	/** @internal — exposed as readonly for Vue reactive proxy compatibility */
	readonly _date: Date;

	constructor(input?: Date | string | number | null) {
		if (input === undefined || input === null) {
			this._date = new Date();
		} else if (input instanceof Date) {
			this._date = new Date(input.getTime());
		} else if (typeof input === 'number') {
			this._date = new Date(input);
		} else if (typeof input === 'string') {
			const luxonDate = DateTime.fromISO(input);
			if (!luxonDate.isValid) {
				throw new Error(`Invalid date string: "${input}"`);
			}
			this._date = luxonDate.toJSDate();
		} else {
			throw new Error(
				`Invalid input type. Expected Date, string, number, or undefined, got ${typeof input}`,
			);
		}
	}

	// ── Static Factory Methods ─────────────────────────────────────────

	static now(): ForgeDate {
		return new ForgeDate();
	}

	static nowInTz(): ForgeDate {
		return ForgeDate.now().fromUTC();
	}

	static fromISO(iso: string): ForgeDate {
		return new ForgeDate(iso);
	}

	static fromDate(date: Date): ForgeDate {
		return new ForgeDate(date);
	}

	static fromMillis(ms: number): ForgeDate {
		return new ForgeDate(ms);
	}

	static fromTime(time: string, format: EDateFormat = EDateFormat.Time): ForgeDate {
		const cleaned = time.replace(/\.\d{1,3}$/, '');
		return ForgeDate.fromString(cleaned, format);
	}

	static fromDateString(dateString: string): ForgeDate {
		const jsDate = new Date(dateString);
		if (isNaN(jsDate.getTime())) {
			throw new Error(`Invalid date string: "${dateString}"`);
		}
		return ForgeDate.fromDate(jsDate);
	}

	static fromString(dateString: string, format: EDateFormat = EDateFormat.Default): ForgeDate {
		const luxonDate = DateTime.fromFormat(dateString, format);
		if (!luxonDate.isValid) {
			throw new Error(`Invalid date string: "${dateString}" with format "${format}"`);
		}
		return ForgeDate.fromDate(luxonDate.toJSDate());
	}

	static parse(dateString: string, fallback?: ForgeDate): ForgeDate {
		const jsDate = new Date(dateString);
		if (isNaN(jsDate.getTime())) {
			return fallback ?? ForgeDate.now();
		}
		return ForgeDate.fromDate(jsDate);
	}

	// ── Static Comparison Methods ─────────────────────────────────────

	static min(...dates: ForgeDate[]): ForgeDate {
		if (dates.length === 0) throw new Error('At least one date required');
		return dates.reduce((min, d) => (d.isBefore(min) ? d : min));
	}

	static max(...dates: ForgeDate[]): ForgeDate {
		if (dates.length === 0) throw new Error('At least one date required');
		return dates.reduce((max, d) => (d.isAfter(max) ? d : max));
	}

	// ── Component Getters ──────────────────────────────────────────────

	get year(): number {
		return this._date.getFullYear();
	}
	get month(): number {
		return this._date.getMonth() + 1;
	}
	get day(): number {
		return this._date.getDate();
	}
	get hour(): number {
		return this._date.getHours();
	}
	get minute(): number {
		return this._date.getMinutes();
	}
	get second(): number {
		return this._date.getSeconds();
	}
	get millisecond(): number {
		return this._date.getMilliseconds();
	}
	get weekday(): number {
		return DateTime.fromJSDate(this._date).weekday;
	}

	daysInMonth(): number {
		return DateTime.fromJSDate(this._date).daysInMonth ?? 0;
	}

	// ── Date Arithmetic ────────────────────────────────────────────────

	plus(duration: DurationInput): ForgeDate {
		return ForgeDate.fromDate(DateTime.fromJSDate(this._date).plus(duration).toJSDate());
	}

	minus(duration: DurationInput): ForgeDate {
		return ForgeDate.fromDate(DateTime.fromJSDate(this._date).minus(duration).toJSDate());
	}

	diff(
		other: ForgeDate,
		unit: 'milliseconds' | 'seconds' | 'minutes' | 'hours' | 'days' = 'seconds',
	): number {
		const luxonDate = DateTime.fromJSDate(this._date);
		const otherLuxonDate = DateTime.fromJSDate(other._date);
		if (!luxonDate.isValid || !otherLuxonDate.isValid) throw new Error('Invalid date');
		return Math.abs(luxonDate.diff(otherLuxonDate, unit).as(unit));
	}

	diffSigned(
		other: ForgeDate,
		unit: 'milliseconds' | 'seconds' | 'minutes' | 'hours' | 'days' = 'seconds',
	): number {
		const luxonDate = DateTime.fromJSDate(this._date);
		const otherLuxonDate = DateTime.fromJSDate(other._date);
		if (!luxonDate.isValid || !otherLuxonDate.isValid) throw new Error('Invalid date');
		return luxonDate.diff(otherLuxonDate, unit).as(unit);
	}

	start(unit: 'day' | 'week' | 'month' | 'year'): ForgeDate {
		// Luxon's startOf('week') is hardcoded to ISO Monday and ignores locale/preference.
		// Honour the user's WeekStart preference (wired in initManager) instead, so every
		// consumer of `.startOf('week')` lands on the user's first day of the week.
		if (unit === 'week') {
			const weekStart = getWeekStartForCalendar();
			const dow = this._date.getDay();
			const diff = (dow - weekStart + 7) % 7;
			return ForgeDate.fromDate(
				DateTime.fromJSDate(this._date).startOf('day').minus({ days: diff }).toJSDate(),
			);
		}
		return ForgeDate.fromDate(DateTime.fromJSDate(this._date).startOf(unit).toJSDate());
	}

	startOf(unit: 'day' | 'week' | 'month' | 'year'): ForgeDate {
		return this.start(unit);
	}

	end(unit: 'day' | 'week' | 'month' | 'year'): ForgeDate {
		// Mirror start('week'): the week ends 6 days after its start, regardless of which
		// weekday that is in the user's preference.
		if (unit === 'week') {
			return this.start('week').plus({ days: 6 }).end('day');
		}
		return ForgeDate.fromDate(DateTime.fromJSDate(this._date).endOf(unit).toJSDate());
	}

	endOf(unit: 'day' | 'week' | 'month' | 'year'): ForgeDate {
		return this.end(unit);
	}

	changeToDate(target: ForgeDate): ForgeDate {
		const newDate = new Date(target._date.getTime());
		newDate.setHours(
			this._date.getHours(),
			this._date.getMinutes(),
			this._date.getSeconds(),
			this._date.getMilliseconds(),
		);
		return ForgeDate.fromDate(newDate);
	}

	setHourMinute(hours: number, minutes: number = 0): ForgeDate {
		const updated = DateTime.fromJSDate(this._date).set({
			hour: hours,
			minute: minutes,
			second: 0,
			millisecond: 0,
		});
		if (!updated.isValid) throw new Error(`Invalid time: ${hours}:${minutes}`);
		return ForgeDate.fromDate(updated.toJSDate());
	}

	// ── Comparison Methods ─────────────────────────────────────────────

	isBefore(other: ForgeDate): boolean {
		return this._date.getTime() < other._date.getTime();
	}
	isAfter(other: ForgeDate): boolean {
		return this._date.getTime() > other._date.getTime();
	}

	isSame(other: ForgeDate, unit: 'day' | 'hour' | 'minute' | 'second' = 'day'): boolean {
		return DateTime.fromJSDate(this._date).hasSame(DateTime.fromJSDate(other._date), unit);
	}

	isBetween(start: ForgeDate, end: ForgeDate): boolean {
		const t = this._date.getTime();
		return t >= start._date.getTime() && t <= end._date.getTime();
	}

	// ── Timezone Conversion ────────────────────────────────────────────

	toUTC(): ForgeDate {
		const orgTimezone = getOrgTimezone();
		const browserZone = getBrowserTimezone();
		if (orgTimezone === browserZone) return ForgeDate.fromDate(this._date);
		const offsetBrowser = DateTime.now().setZone(browserZone).offset / 60;
		const offsetOrg = DateTime.now().setZone(orgTimezone).offset / 60;
		return ForgeDate.fromDate(
			DateTime.fromJSDate(this._date)
				.minus({ hours: offsetOrg - offsetBrowser })
				.toJSDate(),
		);
	}

	fromUTC(): ForgeDate {
		const orgTimezone = getOrgTimezone();
		const browserZone = getBrowserTimezone();
		if (orgTimezone === browserZone) return ForgeDate.fromDate(this._date);
		const offsetBrowser = DateTime.now().setZone(browserZone).offset / 60;
		const offsetOrg = DateTime.now().setZone(orgTimezone).offset / 60;
		return ForgeDate.fromDate(
			DateTime.fromJSDate(this._date)
				.plus({ hours: offsetOrg - offsetBrowser })
				.toJSDate(),
		);
	}

	toTimezone(orgTimezone: string): ForgeDate {
		const browserZone = getBrowserTimezone();
		if (orgTimezone === browserZone) return ForgeDate.fromDate(this._date);
		const offsetMinBrowser = DateTime.now().setZone(browserZone).offset;
		const offsetMinOrg = DateTime.now().setZone(orgTimezone).offset;
		return ForgeDate.fromDate(
			DateTime.fromJSDate(this._date)
				.plus({ minutes: offsetMinOrg - offsetMinBrowser })
				.toJSDate(),
		);
	}

	// ── Conversion Methods ─────────────────────────────────────────────

	toDate(): Date {
		return new Date(this._date.getTime());
	}
	/**
	 * ISO-8601 string for the wrapped date, or empty string when the date is
	 * invalid. We return `''` instead of letting the underlying
	 * `Date.prototype.toISOString()` throw `RangeError: Invalid time value`,
	 * because partial inputs (e.g. a half-typed time-range field) routinely
	 * produce invalid intermediate dates and the template rendering them
	 * shouldn't blow up the whole tree. Consumers that want strict behaviour
	 * should check `.isValid()` first.
	 */
	toISO(): string {
		if (isNaN(this._date.getTime())) return '';
		return this._date.toISOString();
	}
	toISODate(): string {
		if (isNaN(this._date.getTime())) return '';
		return DateTime.fromJSDate(this._date).toISODate() ?? '';
	}
	toISOTime(): string {
		if (isNaN(this._date.getTime())) return '';
		const time = this._date.toISOString().split('T')[1];
		return time?.split('.')[0] || '';
	}
	toMillis(): number {
		return this._date.getTime();
	}
	valueOf(): number {
		return this._date.valueOf();
	}
	isValid(): boolean {
		return !isNaN(this._date.getTime());
	}

	// ── Formatting Methods ─────────────────────────────────────────────

	format(format?: EDateFormat): string {
		const dateTime = DateTime.fromJSDate(this._date);
		if (!dateTime.isValid) throw new Error('Invalid date');
		const formatToUse = format ? FormatRegionType.resolve(format) : EDateFormat.Default;
		const result = dateTime.setLocale(getDateLocale()).toFormat(formatToUse);
		return result
			.split(' ')
			.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
			.join(' ');
	}

	withTime(time: string): ForgeDate {
		const fmt = time.split(':').length === 3 ? EDateFormat.TimeFull : EDateFormat.Time;
		const timeParts = DateTime.fromFormat(time, fmt);
		if (!timeParts.isValid) throw new Error(`Invalid time: "${time}"`);
		const updated = DateTime.fromJSDate(this._date).set({
			hour: timeParts.hour,
			minute: timeParts.minute,
			second: timeParts.second || 0,
			millisecond: 0,
		});
		return ForgeDate.fromDate(updated.toJSDate());
	}

	toRelative(): string {
		const dt = DateTime.fromJSDate(this._date);
		return dt.toRelative() ?? dt.toLocaleString(DateTime.DATETIME_SHORT);
	}

	/** `today` / `yesterday` / `Xd ago` / `Xw ago` / `Xmo ago` / `Xy ago`. Future dates collapse to `today`. */
	formatRelativePast(): string {
		if (!this.isValid()) return '';
		const days = Math.floor(ForgeDate.now().diffSigned(this, 'days'));
		if (days < 1) return 'today';
		if (days === 1) return 'yesterday';
		if (days < 7) return `${days}d ago`;
		if (days < 30) return `${Math.floor(days / 7)}w ago`;
		if (days < 365) return `${Math.floor(days / 30)}mo ago`;
		return `${Math.floor(days / 365)}y ago`;
	}

	/** `soon` / `in <1h` / `in Xh` / `in Xd`. Past dates collapse to `soon`. */
	formatRelativeFuture(): string {
		if (!this.isValid()) return '';
		const ms = this.toMillis() - ForgeDate.now().toMillis();
		if (ms <= 0) return 'soon';
		const hours = Math.floor(ms / (1000 * 60 * 60));
		if (hours < 1) return 'in <1h';
		if (hours < 24) return `in ${hours}h`;
		return `in ${Math.floor(hours / 24)}d`;
	}

	formatInTz(format: EDateFormat): string {
		const tz = getOrgTimezone();
		const dateTime = DateTime.fromJSDate(this._date).setZone(tz);
		if (!dateTime.isValid) throw new Error('Invalid date');
		return dateTime.setLocale(getDateLocale()).toFormat(FormatRegionType.resolve(format));
	}

	weekdayLong(): string {
		const dateTime = DateTime.fromJSDate(this._date);
		if (!dateTime.isValid) throw new Error('Invalid date');
		const dayKey = (dateTime.weekdayLong ?? '').toLowerCase();
		return weekDayLongMap[dayKey] ?? dateTime.weekdayLong ?? '';
	}

	weekdayShort(): string {
		const dateTime = DateTime.fromJSDate(this._date);
		if (!dateTime.isValid) throw new Error('Invalid date');
		const dayKey = (dateTime.weekdayShort ?? '').toLowerCase();
		return weekDayShortMap[dayKey] ?? dateTime.weekdayShort ?? '';
	}
}
