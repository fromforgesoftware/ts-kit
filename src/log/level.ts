export enum LogLevel {
	All = 0,
	Debug = 1,
	Info = 2,
	Warn = 3,
	Error = 4,
	Fatal = 5,
	Off = 6,
}

export type LogLevelName = 'all' | 'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'off';

const NAME_TO_LEVEL: Record<LogLevelName, LogLevel> = {
	all: LogLevel.All,
	debug: LogLevel.Debug,
	info: LogLevel.Info,
	warn: LogLevel.Warn,
	error: LogLevel.Error,
	fatal: LogLevel.Fatal,
	off: LogLevel.Off,
};

export function parseLogLevel(name: LogLevelName | LogLevel): LogLevel {
	if (typeof name === 'number') return name;
	const level = NAME_TO_LEVEL[name];
	if (level === undefined) throw new Error(`Invalid log level: ${name}`);
	return level;
}

export function logLevelName(level: LogLevel): string {
	return LogLevel[level];
}
