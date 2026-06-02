import { LogLevel, type LogTransport } from './types';
import { ConsoleTransport, NoOpTransport } from './transports';

interface ViteEnv {
	VITE_LOG_LEVEL?: string;
}

interface ImportMetaWithEnv {
	env?: ViteEnv;
}

class Logger {
	private level: LogLevel;
	private transport: LogTransport;
	private appName: string;

	constructor(appName: string = 'app') {
		this.appName = appName;
		this.level = this.parseEnvLevel() ?? LogLevel.INFO;
		this.transport = new ConsoleTransport();
	}

	private parseEnvLevel(): LogLevel | undefined {
		let envLevel: string | undefined;

		if (typeof import.meta !== 'undefined') {
			const meta = import.meta as ImportMetaWithEnv;
			envLevel = meta.env?.VITE_LOG_LEVEL;
		}

		if (!envLevel && typeof process !== 'undefined') {
			envLevel = process.env.VITE_LOG_LEVEL;
		}

		if (!envLevel) return undefined;

		const normalized = envLevel.toLowerCase();
		if (normalized === 'none') {
			this.transport = new NoOpTransport();
			return LogLevel.ERROR;
		}

		const map: Record<string, LogLevel> = {
			error: LogLevel.ERROR,
			warn: LogLevel.WARN,
			info: LogLevel.INFO,
			log: LogLevel.LOG,
			debug: LogLevel.DEBUG,
			all: LogLevel.All,
		};
		return map[normalized];
	}

	setLevel(level: LogLevel): void {
		this.level = level;
	}

	getLevel(): LogLevel {
		return this.level;
	}

	setTransport(transport: LogTransport): void {
		this.transport = transport;
	}

	getTransport(): LogTransport {
		return this.transport;
	}

	setAppName(appName: string): void {
		this.appName = appName;
	}

	/**
	 * Create a child logger with a different appName.
	 * Shares the same level and transport as the parent.
	 */
	child(appName: string): Logger {
		const child = new Logger(appName);
		child.level = this.level;
		child.transport = this.transport;
		return child;
	}

	error(...args: unknown[]): void {
		if (this.level >= LogLevel.ERROR) {
			this.transport.log(LogLevel.ERROR, this.appName, ...args);
		}
	}

	warn(...args: unknown[]): void {
		if (this.level >= LogLevel.WARN) {
			this.transport.log(LogLevel.WARN, this.appName, ...args);
		}
	}

	info(...args: unknown[]): void {
		if (this.level >= LogLevel.INFO) {
			this.transport.log(LogLevel.INFO, this.appName, ...args);
		}
	}

	log(...args: unknown[]): void {
		if (this.level >= LogLevel.LOG) {
			this.transport.log(LogLevel.LOG, this.appName, ...args);
		}
	}

	debug(...args: unknown[]): void {
		if (this.level >= LogLevel.DEBUG) {
			this.transport.log(LogLevel.DEBUG, this.appName, ...args);
		}
	}
}

export const logger = new Logger();
export { Logger };
