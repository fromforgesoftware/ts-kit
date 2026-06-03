import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	ConsoleTransport,
	Logger,
	LogLevel,
	NoOpTransport,
	logger,
	type LogTransport,
} from '../../legacy-logger/index.js';

class MemoryTransport implements LogTransport {
	calls: { level: LogLevel; tag: string; args: unknown[] }[] = [];
	log(level: LogLevel, tag: string, ...args: unknown[]): void {
		this.calls.push({ level, tag, args });
	}
}

describe('Logger', () => {
	it('defaults to INFO level and a ConsoleTransport', () => {
		const l = new Logger();
		expect(l.getLevel()).toBe(LogLevel.INFO);
		expect(l.getTransport()).toBeInstanceOf(ConsoleTransport);
	});

	it('only emits messages at or above the configured level', () => {
		const sink = new MemoryTransport();
		const l = new Logger('test');
		l.setTransport(sink);
		l.setLevel(LogLevel.WARN);

		l.debug('skip-debug');
		l.info('skip-info');
		l.warn('keep-warn');
		l.error('keep-error');

		expect(sink.calls.map((c) => c.level)).toEqual([LogLevel.WARN, LogLevel.ERROR]);
	});

	it('emits everything at All level', () => {
		const sink = new MemoryTransport();
		const l = new Logger('x');
		l.setTransport(sink);
		l.setLevel(LogLevel.All);

		l.error('e');
		l.warn('w');
		l.info('i');
		l.log('l');
		l.debug('d');

		expect(sink.calls).toHaveLength(5);
	});

	it('passes appName as the tag and forwards args', () => {
		const sink = new MemoryTransport();
		const l = new Logger('svc');
		l.setTransport(sink);
		l.setLevel(LogLevel.DEBUG);

		l.info('hello', { a: 1 }, 2);

		expect(sink.calls[0].tag).toBe('svc');
		expect(sink.calls[0].args).toEqual(['hello', { a: 1 }, 2]);
	});

	it('setAppName changes the emitted tag', () => {
		const sink = new MemoryTransport();
		const l = new Logger('old');
		l.setTransport(sink);
		l.setAppName('new');
		l.error('x');
		expect(sink.calls[0].tag).toBe('new');
	});

	it('child() inherits level and transport but uses its own appName', () => {
		const sink = new MemoryTransport();
		const parent = new Logger('parent');
		parent.setTransport(sink);
		parent.setLevel(LogLevel.DEBUG);

		const child = parent.child('child');
		expect(child.getLevel()).toBe(LogLevel.DEBUG);
		expect(child.getTransport()).toBe(sink);

		child.debug('hi');
		expect(sink.calls[0].tag).toBe('child');
	});

	it('exports a shared singleton logger instance', () => {
		expect(logger).toBeInstanceOf(Logger);
	});
});

describe('ConsoleTransport', () => {
	let spies: Record<string, ReturnType<typeof vi.spyOn>>;

	beforeEach(() => {
		spies = {
			error: vi.spyOn(console, 'error').mockImplementation(() => undefined),
			warn: vi.spyOn(console, 'warn').mockImplementation(() => undefined),
			info: vi.spyOn(console, 'info').mockImplementation(() => undefined),
			debug: vi.spyOn(console, 'debug').mockImplementation(() => undefined),
			log: vi.spyOn(console, 'log').mockImplementation(() => undefined),
		};
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('routes each level to the matching console method with a prefix', () => {
		const t = new ConsoleTransport();
		t.log(LogLevel.ERROR, 'app', 'msg');
		t.log(LogLevel.WARN, 'app', 'msg');
		t.log(LogLevel.INFO, 'app', 'msg');
		t.log(LogLevel.DEBUG, 'app', 'msg');
		t.log(LogLevel.LOG, 'app', 'msg');

		expect(spies.error).toHaveBeenCalledTimes(1);
		expect(spies.warn).toHaveBeenCalledTimes(1);
		expect(spies.info).toHaveBeenCalledTimes(1);
		expect(spies.debug).toHaveBeenCalledTimes(1);
		expect(spies.log).toHaveBeenCalledTimes(1);

		const prefix = spies.error.mock.calls[0][0] as string;
		expect(prefix).toContain('[app]');
		expect(prefix).toContain('ERROR');
	});

	it('omits the bracketed tag when tag is empty', () => {
		const t = new ConsoleTransport();
		t.log(LogLevel.INFO, '', 'msg');
		const prefix = spies.info.mock.calls[0][0] as string;
		expect(prefix.startsWith('[')).toBe(false);
		expect(prefix).toContain('INFO');
	});
});

describe('NoOpTransport', () => {
	it('does nothing and never touches the console', () => {
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		const t = new NoOpTransport();
		t.log();
		expect(errorSpy).not.toHaveBeenCalled();
		errorSpy.mockRestore();
	});
});
