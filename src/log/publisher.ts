import type { LogEntry } from './entry';
import { formatLogEntry } from './entry';
import { LogLevel } from './level';

export interface LogPublisher {
	log(entry: LogEntry, formatted: string): void;
	clear?(): void;
}

export interface ConsolePublisherOptions {
	withDate?: boolean;
}

export class ConsolePublisher implements LogPublisher {
	private readonly withDate: boolean;

	constructor(opts: ConsolePublisherOptions = {}) {
		this.withDate = opts.withDate ?? true;
	}

	log(entry: LogEntry, formatted: string): void {
		const msg = formatted || formatLogEntry(entry, { withDate: this.withDate });
		switch (entry.level) {
			case LogLevel.Error:
			case LogLevel.Fatal:
				console.error(msg, ...entry.params);
				break;
			case LogLevel.Warn:
				console.warn(msg, ...entry.params);
				break;
			case LogLevel.Info:
				console.info(msg, ...entry.params);
				break;
			default:
				console.log(msg, ...entry.params);
		}
	}

	clear(): void {
		console.clear();
	}
}
