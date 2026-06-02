import type { LogEntry } from './entry.js';
import { formatLogEntry } from './entry.js';
import { LogLevel, parseLogLevel, type LogLevelName } from './level.js';
import { ConsolePublisher, type LogPublisher } from './publisher.js';

export interface LogServiceOptions {
	name?: string;
	level?: LogLevelName | LogLevel;
	withDate?: boolean;
	publishers?: LogPublisher[];
}

export class LogService {
	private readonly appName: string;
	private readonly withDate: boolean;
	private readonly publishers: LogPublisher[];
	private level: LogLevel;

	constructor(opts: LogServiceOptions = {}) {
		this.appName = opts.name ?? 'app';
		this.withDate = opts.withDate ?? true;
		this.level = parseLogLevel(opts.level ?? 'debug');
		this.publishers = opts.publishers ?? [new ConsolePublisher({ withDate: this.withDate })];
	}

	debug(message: string, ...params: unknown[]): void {
		this.write(LogLevel.Debug, message, params);
	}

	info(message: string, ...params: unknown[]): void {
		this.write(LogLevel.Info, message, params);
	}

	warn(message: string, ...params: unknown[]): void {
		this.write(LogLevel.Warn, message, params);
	}

	error(message: string, ...params: unknown[]): void {
		this.write(LogLevel.Error, message, params);
	}

	fatal(message: string, ...params: unknown[]): void {
		this.write(LogLevel.Fatal, message, params);
	}

	setLevel(level: LogLevelName | LogLevel): void {
		this.level = parseLogLevel(level);
	}

	getLevel(): LogLevel {
		return this.level;
	}

	child(suffix: string): LogService {
		return new LogService({
			name: `${this.appName}:${suffix}`,
			level: this.level,
			withDate: this.withDate,
			publishers: this.publishers,
		});
	}

	private write(level: LogLevel, message: string, params: unknown[]): void {
		if (!this.shouldLog(level)) return;
		const entry: LogEntry = {
			appName: this.appName,
			level,
			message,
			params,
			timestamp: new Date(),
		};
		const formatted = formatLogEntry(entry, { withDate: this.withDate });
		for (const pub of this.publishers) pub.log(entry, formatted);
	}

	private shouldLog(level: LogLevel): boolean {
		if (this.level === LogLevel.Off) return false;
		if (this.level === LogLevel.All) return true;
		return level >= this.level;
	}
}
