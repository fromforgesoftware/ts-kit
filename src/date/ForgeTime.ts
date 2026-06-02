import { DateTime, Duration } from 'luxon';
import { resolveFormat, getHourCycle } from './config';
import { ForgeDate } from './ForgeDate';

/**
 * ForgeTime - Static utility class for time-string and duration-number operations.
 *
 * Replaces the String.prototype and Number.prototype date/time extensions.
 * Use this class for operations that work with raw time strings (e.g. "08:30")
 * or duration numbers (seconds/milliseconds) instead of full ForgeDate values.
 */
export class ForgeTime {
	// ── String operations ──────────────────────────────────────────────

	/**
	 * Format a time string (HH / HH:mm / HH:mm:ss / HH:mm:ss.SSS) in the given format.
	 * Replaces `String.prototype.timeFormat`.
	 */
	static format(time: string, format: string): string {
		const parts = time.split(':');
		const formatTemplates: Record<number, string> = {
			1: 'HH',
			2: 'HH:mm',
			3: 'HH:mm:ss',
			4: 'HH:mm:ss.SSS',
		};
		const sourceFormat = formatTemplates[parts.length];
		if (!sourceFormat) {
			throw new Error(`Invalid time format: ${time}`);
		}
		const temp = DateTime.fromFormat(time, sourceFormat);
		if (!temp.isValid) {
			console.warn(`Invalid date format for "${time}" with format "${sourceFormat}"`);
			return time;
		}
		return temp.toFormat(format);
	}

	/**
	 * Return the seconds since midnight for a time in "HH:mm" format.
	 * Replaces `String.prototype.timeMidnight`.
	 */
	static secondsSinceMidnight(time: string): number {
		const timeDateTime = DateTime.fromFormat(time, 'HH:mm');
		if (!timeDateTime.isValid) {
			throw new Error(`Invalid time format for secondsSinceMidnight: ${time}. Expected HH:mm`);
		}
		return timeDateTime.hour * 3600 + timeDateTime.minute * 60 + timeDateTime.second;
	}

	/**
	 * Strip trailing millisecond component from a time string (e.g. "10:30:45.123" -> "10:30:45").
	 * Replaces `String.prototype.timeRemoveMillis`.
	 */
	static removeMillis(time: string): string {
		return time.replace(/\.\d{1,3}$/, '');
	}

	/**
	 * Convert an ISO time (HH:mm, HH:mm:ss) to total seconds.
	 * Replaces `String.prototype.timeToSeconds`.
	 */
	static toSeconds(time: string): number {
		return Duration.fromISOTime(time).as('seconds');
	}

	/**
	 * Parse a formatted time/date string to a ForgeDate.
	 * Replaces `String.prototype.formatToDate` (which returned a native Date).
	 */
	static toDate(str: string, format: string): ForgeDate {
		const temp = DateTime.fromFormat(str, format);
		if (!temp.isValid) {
			throw new Error(`Invalid date "${str}" with format "${format}"`);
		}
		return ForgeDate.fromDate(temp.toJSDate());
	}

	/**
	 * Reformat a date string from `inputFormat` (default "yyyy-MM-dd") to `format`.
	 * Returns `fallback` (or "-") if parsing fails.
	 * Replaces `String.prototype.dateFormat`.
	 */
	static formatDate(
		dateStr: string,
		format: string,
		inputFormat: string = 'yyyy-MM-dd',
		fallback?: string,
	): string {
		const resolvedInput = resolveFormat(inputFormat);
		const temp = DateTime.fromFormat(dateStr, resolvedInput);
		if (!temp.isValid) {
			return fallback ?? '-';
		}
		return temp.toFormat(resolveFormat(format));
	}

	/**
	 * Combine a time string with a source ForgeDate, returning a new ForgeDate.
	 * Replaces `String.prototype.setTime` (which took Date and returned Date).
	 */
	static setTime(time: string, source: ForgeDate, timeFormat: string): ForgeDate {
		const timeDateTime = DateTime.fromFormat(time, timeFormat);
		if (!timeDateTime.isValid) {
			throw new Error(`Invalid time: ${time} with format ${timeFormat}`);
		}
		const sourceDT = DateTime.fromJSDate(source.toDate());
		const result = sourceDT.set({
			hour: timeDateTime.hour,
			minute: timeDateTime.minute,
			second: timeDateTime.second || 0,
			millisecond: 0,
		});
		return ForgeDate.fromDate(result.toJSDate());
	}

	// ── Number operations ──────────────────────────────────────────────

	/**
	 * Format a seconds count as a time string (HH:mm:ss) in the specified format.
	 * Replaces `Number.prototype.secTimeFormat`.
	 */
	static fromSeconds(secs: number, format: string): string {
		const totalSeconds = Math.floor(secs);
		const hours = Math.floor(totalSeconds / 3600);
		const minutes = Math.floor((totalSeconds % 3600) / 60);
		const seconds = totalSeconds % 60;

		// 12-hour format support
		if (format.includes('A') || format.includes('a')) {
			const h12 = hours % 12 || 12;
			const period = hours < 12 || hours === 24 ? 'AM' : 'PM';
			return format
				.replace('hh', h12.toString().padStart(2, '0'))
				.replace('h', h12.toString())
				.replace('mm', minutes.toString().padStart(2, '0'))
				.replace('ss', seconds.toString().padStart(2, '0'))
				.replace('A', period)
				.replace('a', period.toLowerCase());
		}

		return format
			.replace('HH', hours.toString().padStart(2, '0'))
			.replace('mm', minutes.toString().padStart(2, '0'))
			.replace('ss', seconds.toString().padStart(2, '0'));
	}

	/**
	 * Format a number as zero-padded hours string (00..23).
	 * Replaces `Number.prototype.formatHours`.
	 */
	static formatHours(value: number): string {
		const displayHour = value % 24;
		return `${displayHour.toString().padStart(2, '0')}`;
	}

	/**
	 * Convert seconds to minutes.
	 * Replaces `Number.prototype.secToMin`.
	 */
	static secToMin(secs: number, decimalNum?: number): number {
		const minutes = secs / 60;
		if (decimalNum !== undefined) {
			return Number(minutes.toFixed(decimalNum));
		}
		return minutes;
	}

	/**
	 * Format a duration in seconds as human-readable (e.g. "2d 3h 15m").
	 * Replaces `Number.prototype.durationToTime`.
	 */
	static durationToTime(secs: number, compact: boolean = false): string {
		const duration = Duration.fromObject({ seconds: secs });
		const days = Math.floor(duration.as('days'));
		const hours = Math.floor(duration.as('hours') % 24);
		const minutes = Math.floor(duration.as('minutes') % 60);

		if (compact) {
			if (days > 0) return `${days}d`;
			if (hours > 0) return `${hours}h`;
			return `${minutes}m`;
		}

		const parts: string[] = [];
		if (days > 0) parts.push(`${days}d`);
		if (hours > 0) parts.push(`${hours}h`);
		if (minutes > 0) parts.push(`${minutes}m`);
		return parts.length > 0 ? parts.join(' ') : '0m';
	}

	/**
	 * Convert seconds to hours (as string).
	 * Replaces `Number.prototype.durationToHours`.
	 */
	static durationToHours(secs: number): string {
		return String(secs / 3600);
	}

	/**
	 * Format milliseconds as a human-readable duration.
	 * Replaces `Number.prototype.formatDuration`.
	 */
	static formatDuration(ms: number, format: 'short' | 'long' = 'short'): string {
		if (ms < 0) return format === 'short' ? '0s' : '0 seconds';

		const seconds = Math.floor(ms / 1000);
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);

		const remainingSeconds = seconds % 60;
		const remainingMinutes = minutes % 60;

		const parts: string[] = [];

		if (hours > 0) {
			parts.push(format === 'short' ? `${hours}h` : `${hours} ${hours === 1 ? 'hour' : 'hours'}`);
		}
		if (remainingMinutes > 0) {
			parts.push(
				format === 'short'
					? `${remainingMinutes}m`
					: `${remainingMinutes} ${remainingMinutes === 1 ? 'minute' : 'minutes'}`,
			);
		}
		if (remainingSeconds > 0 || parts.length === 0) {
			parts.push(
				format === 'short'
					? `${remainingSeconds}s`
					: `${remainingSeconds} ${remainingSeconds === 1 ? 'second' : 'seconds'}`,
			);
		}

		return parts.join(' ');
	}

	/**
	 * Format seconds as a human-readable duration.
	 * Replaces `Number.prototype.formatDurationSec`.
	 */
	static formatDurationSec(totalSeconds: number, format: 'short' | 'long' = 'short'): string {
		if (totalSeconds < 0) return format === 'short' ? '0s' : '0 seconds';

		const seconds = Math.floor(totalSeconds);
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);

		const remainingSeconds = seconds % 60;
		const remainingMinutes = minutes % 60;

		const parts: string[] = [];

		if (hours > 0) {
			parts.push(format === 'short' ? `${hours}h` : `${hours} ${hours === 1 ? 'hour' : 'hours'}`);
		}
		if (remainingMinutes > 0) {
			parts.push(
				format === 'short'
					? `${remainingMinutes}m`
					: `${remainingMinutes} ${remainingMinutes === 1 ? 'minute' : 'minutes'}`,
			);
		}
		if (remainingSeconds > 0 || parts.length === 0) {
			parts.push(
				format === 'short'
					? `${remainingSeconds}s`
					: `${remainingSeconds} ${remainingSeconds === 1 ? 'second' : 'seconds'}`,
			);
		}

		return parts.join(' ');
	}

	/**
	 * Format seconds as "Xm Ys" (or "Xs" for <60).
	 * Replaces `Number.prototype.toMinutesSeconds`.
	 */
	static toMinutesSeconds(secs: number): string {
		const totalSeconds = Math.round(secs);
		if (totalSeconds < 60) {
			return `${totalSeconds}s`;
		}
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = totalSeconds % 60;
		if (seconds === 0) {
			return `${minutes}m`;
		}
		return `${minutes}m ${seconds}s`;
	}

	// ── Display-format operations (hour-cycle-aware) ───────────────────

	/**
	 * Format seconds-since-midnight as a display time string.
	 * Respects the current hour cycle preference (12h/24h).
	 * Values past 24h wrap (e.g. 30:00 → "06:00") so overnight shift end labels read as a real time of day.
	 * 24h → "13:00", 12h → "1:00 PM"
	 */
	static formatTimeOfDay(totalSec: number): string {
		const wrapped = ((Math.floor(totalSec) % 86400) + 86400) % 86400;
		const h = Math.floor(wrapped / 3600);
		const m = Math.floor((wrapped % 3600) / 60);

		if (getHourCycle() === 12) {
			const h12 = h % 12 || 12;
			const period = h < 12 ? 'AM' : 'PM';
			return `${h12}:${String(m).padStart(2, '0')} ${period}`;
		}

		return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
	}

	/**
	 * Format seconds-since-midnight as a short hour label.
	 * Values past 24h wrap (e.g. 26h → "2"). 24h → "14", 12h → "2 PM"
	 */
	static formatTimeOfDayShort(totalSec: number): string {
		const wrapped = ((Math.floor(totalSec) % 86400) + 86400) % 86400;
		const h = Math.floor(wrapped / 3600);

		if (getHourCycle() === 12) {
			const h12 = h % 12 || 12;
			const period = h < 12 ? 'AM' : 'PM';
			return `${h12} ${period}`;
		}

		return String(h);
	}

	/**
	 * Compute the end time given a start time ("HH:mm") and duration in seconds.
	 * Returns a display-formatted time string respecting the current hour cycle.
	 */
	static endTime(startTime: string, durationSec: number): string {
		const totalSec = ForgeTime.toSeconds(startTime) + durationSec;
		return ForgeTime.formatTimeOfDay(totalSec);
	}

	/**
	 * Format a start time and duration as a display time range.
	 * Returns e.g. "09:00 – 17:00" or "9:00 AM – 5:00 PM".
	 */
	static formatTimeRange(startTime: string, durationSec: number): string {
		if (!startTime) return '';
		const startSec = ForgeTime.toSeconds(startTime);
		const endSec = startSec + durationSec;
		return `${ForgeTime.formatTimeOfDay(startSec)} – ${ForgeTime.formatTimeOfDay(endSec)}`;
	}

	/**
	 * Format a seconds-since-midnight range as a display string.
	 * Returns e.g. "09:00 – 17:00" or "9:00 AM – 5:00 PM".
	 */
	static formatSecRange(startSec: number, endSec: number): string {
		return `${ForgeTime.formatTimeOfDay(startSec)} – ${ForgeTime.formatTimeOfDay(endSec)}`;
	}

	/**
	 * Convert total minutes to a time string in "HH:mm" (24h, for data/internal use).
	 * Wraps at 24h. For display use formatTimeOfDay instead.
	 */
	static minutesToTime(totalMinutes: number): string {
		const clamped = ((totalMinutes % 1440) + 1440) % 1440;
		const h = Math.floor(clamped / 60);
		const m = clamped % 60;
		return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
	}
}
