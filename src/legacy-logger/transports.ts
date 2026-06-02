import { LogLevel, type LogTransport } from './types';

const LEVEL_NAMES: Record<LogLevel, string> = {
	[LogLevel.ERROR]: 'ERROR',
	[LogLevel.WARN]: 'WARN',
	[LogLevel.INFO]: 'INFO',
	[LogLevel.LOG]: 'LOG',
	[LogLevel.DEBUG]: 'DEBUG',
	[LogLevel.All]: 'ALL',
};

/**
 * Default console transport with structured output.
 *
 * Output: [app] 2026-04-16T10:30:00.000Z INFO message
 */
export class ConsoleTransport implements LogTransport {
	log(level: LogLevel, tag: string, ...args: unknown[]): void {
		const timestamp = new Date().toISOString();
		const levelName = LEVEL_NAMES[level] ?? 'LOG';
		const prefix = tag ? `[${tag}] ${timestamp} ${levelName}` : `${timestamp} ${levelName}`;

		switch (level) {
			case LogLevel.ERROR:
				console.error(prefix, ...args);
				break;
			case LogLevel.WARN:
				console.warn(prefix, ...args);
				break;
			case LogLevel.INFO:
				console.info(prefix, ...args);
				break;
			case LogLevel.DEBUG:
				console.debug(prefix, ...args);
				break;
			default:
				console.log(prefix, ...args);
		}
	}
}

/**
 * NoOp transport for production - completely silent.
 * Set via VITE_LOG_LEVEL=none or logger.setTransport(new NoOpTransport())
 */
export class NoOpTransport implements LogTransport {
	log(): void {
		// Intentionally empty - maximum performance
	}
}
