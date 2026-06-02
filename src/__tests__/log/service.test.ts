import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	ConsolePublisher,
	LogLevel,
	LogService,
	type LogEntry,
	type LogPublisher,
} from '../../log';

class MemoryPublisher implements LogPublisher {
	entries: { entry: LogEntry; formatted: string }[] = [];
	log(entry: LogEntry, formatted: string): void {
		this.entries.push({ entry, formatted });
	}
}

describe('LogService', () => {
	it('writes entries at or above the configured level', () => {
		const sink = new MemoryPublisher();
		const log = new LogService({ level: 'info', publishers: [sink] });

		log.debug('skipped');
		log.info('kept-info');
		log.warn('kept-warn');
		log.error('kept-error');

		expect(sink.entries.map((e) => e.entry.message)).toEqual([
			'kept-info',
			'kept-warn',
			'kept-error',
		]);
	});

	it('respects level=off (no output)', () => {
		const sink = new MemoryPublisher();
		const log = new LogService({ level: 'off', publishers: [sink] });

		log.debug('x');
		log.error('y');

		expect(sink.entries).toEqual([]);
	});

	it('level=all emits debug and above', () => {
		const sink = new MemoryPublisher();
		const log = new LogService({ level: 'all', publishers: [sink] });

		log.debug('d');
		log.info('i');

		expect(sink.entries).toHaveLength(2);
	});

	it('attaches appName + timestamp + params to entries', () => {
		const sink = new MemoryPublisher();
		const log = new LogService({ name: 'svc', level: 'debug', publishers: [sink] });

		log.info('hello', { user: 1 }, 42);

		const e = sink.entries[0].entry;
		expect(e.appName).toBe('svc');
		expect(e.level).toBe(LogLevel.Info);
		expect(e.message).toBe('hello');
		expect(e.params).toEqual([{ user: 1 }, 42]);
		expect(e.timestamp).toBeInstanceOf(Date);
	});

	it('formats with date by default and without when disabled', () => {
		const sink = new MemoryPublisher();
		const log = new LogService({
			name: 'svc',
			level: 'debug',
			withDate: false,
			publishers: [sink],
		});

		log.info('x');

		expect(sink.entries[0].formatted).toBe('[svc] Info x');
	});

	it('child() inherits level + publishers and appends name suffix', () => {
		const sink = new MemoryPublisher();
		const root = new LogService({ name: 'svc', level: 'info', publishers: [sink] });
		const child = root.child('db');

		child.info('q');

		expect(sink.entries[0].entry.appName).toBe('svc:db');
	});

	it('setLevel() retunes filtering at runtime', () => {
		const sink = new MemoryPublisher();
		const log = new LogService({ level: 'warn', publishers: [sink] });

		log.info('skip');
		log.setLevel('debug');
		log.info('keep');

		expect(sink.entries.map((e) => e.entry.message)).toEqual(['keep']);
	});

	it('rejects an unknown level name', () => {
		expect(() => new LogService({ level: 'verbose' as never })).toThrow(/Invalid log level/);
	});

	it('defaults to a console publisher when none are supplied', () => {
		const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
		const log = new LogService({ name: 'svc', level: 'debug', withDate: false });

		log.debug('hi');

		expect(spy).toHaveBeenCalledWith('[svc] Debug hi');
		spy.mockRestore();
	});
});

describe('ConsolePublisher', () => {
	let logSpy: ReturnType<typeof vi.spyOn>;
	let infoSpy: ReturnType<typeof vi.spyOn>;
	let warnSpy: ReturnType<typeof vi.spyOn>;
	let errorSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
		infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
		warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
		errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
	});

	afterEach(() => {
		logSpy.mockRestore();
		infoSpy.mockRestore();
		warnSpy.mockRestore();
		errorSpy.mockRestore();
	});

	it('routes by level to the matching console method', () => {
		const sink = new ConsolePublisher({ withDate: false });
		const log = new LogService({
			name: 'svc',
			level: 'debug',
			publishers: [sink],
			withDate: false,
		});

		log.debug('d');
		log.info('i');
		log.warn('w');
		log.error('e');
		log.fatal('f');

		expect(logSpy).toHaveBeenCalledWith('[svc] Debug d');
		expect(infoSpy).toHaveBeenCalledWith('[svc] Info i');
		expect(warnSpy).toHaveBeenCalledWith('[svc] Warn w');
		expect(errorSpy).toHaveBeenNthCalledWith(1, '[svc] Error e');
		expect(errorSpy).toHaveBeenNthCalledWith(2, '[svc] Fatal f');
	});

	it('clear() calls console.clear', () => {
		const clearSpy = vi.spyOn(console, 'clear').mockImplementation(() => undefined);
		new ConsolePublisher().clear();
		expect(clearSpy).toHaveBeenCalled();
		clearSpy.mockRestore();
	});
});
