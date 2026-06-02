import { type LogLevel, logLevelName } from './level';

export interface LogEntry {
	appName?: string;
	level: LogLevel;
	message: string;
	params: unknown[];
	timestamp: Date;
}

export interface FormatOptions {
	withDate: boolean;
}

export function formatLogEntry(entry: LogEntry, opts: FormatOptions): string {
	const parts: string[] = [];
	if (entry.appName) parts.push(`[${entry.appName}]`);
	if (opts.withDate) parts.push(entry.timestamp.toISOString());
	parts.push(`${logLevelName(entry.level)} ${entry.message}`);
	return parts.join(' ');
}
