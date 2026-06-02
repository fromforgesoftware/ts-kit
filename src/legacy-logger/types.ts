export enum LogLevel {
	ERROR = 0,
	WARN = 1,
	INFO = 2,
	LOG = 3,
	DEBUG = 4,
	All = 5,
}

/**
 * Transport interface for pluggable logging backends.
 * Implement this to add Azure, GCP, Datadog, etc.
 */
export interface LogTransport {
	log(level: LogLevel, tag: string, ...args: unknown[]): void;
}
