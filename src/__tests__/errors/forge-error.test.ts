import { afterEach, describe, expect, it, vi } from 'vitest';
import { ForgeError, setErrorMonitorHook, ErrorCodes } from '../../errors/index.js';

describe('ForgeError', () => {
	afterEach(() => {
		setErrorMonitorHook(null);
	});

	it('is an instanceof Error and ForgeError', () => {
		const e = new ForgeError({ code: 'NOT_FOUND', message: 'm' });
		expect(e).toBeInstanceOf(Error);
		expect(e).toBeInstanceOf(ForgeError);
		expect(e.name).toBe('ForgeError');
	});

	it('defaults userMessage to the code default key when none provided', () => {
		const e = new ForgeError({ code: 'FORBIDDEN', message: 'tech' });
		expect(e.userMessage).toBe('You do not have permission to perform this action.');
		expect(e.userMessageKey).toBe(e.userMessage);
	});

	it('uses the provided userMessage key', () => {
		const e = new ForgeError({ code: 'NOT_FOUND', message: 'tech', userMessage: 'custom.key' });
		expect(e.userMessage).toBe('custom.key');
	});

	it('sets timestamp and stores meta/status/cause', () => {
		const cause = new Error('root');
		const e = new ForgeError({
			code: 'CONFLICT',
			message: 'm',
			status: 409,
			meta: { id: 7 },
			cause,
		});
		expect(e.status).toBe(409);
		expect(e.meta).toEqual({ id: 7 });
		expect(e.cause).toBe(cause);
		expect(typeof e.timestamp).toBe('number');
	});

	it('defaults retryable true for NETWORK_ERROR and SERVER_ERROR, false otherwise', () => {
		expect(new ForgeError({ code: 'NETWORK_ERROR', message: 'm' }).retryable).toBe(true);
		expect(new ForgeError({ code: 'SERVER_ERROR', message: 'm' }).retryable).toBe(true);
		expect(new ForgeError({ code: 'NOT_FOUND', message: 'm' }).retryable).toBe(false);
	});

	it('honours an explicit retryable override', () => {
		expect(new ForgeError({ code: 'NETWORK_ERROR', message: 'm', retryable: false }).retryable).toBe(
			false,
		);
	});

	it('isType matches the code', () => {
		const e = new ForgeError({ code: 'VALIDATION_ERROR', message: 'm' });
		expect(e.isType('VALIDATION_ERROR')).toBe(true);
		expect(e.isType('NOT_FOUND')).toBe(false);
	});

	it('isClientError / isServerError based on status', () => {
		expect(new ForgeError({ code: 'NOT_FOUND', message: 'm', status: 404 }).isClientError()).toBe(
			true,
		);
		expect(new ForgeError({ code: 'SERVER_ERROR', message: 'm', status: 500 }).isServerError()).toBe(
			true,
		);
		expect(new ForgeError({ code: 'SERVER_ERROR', message: 'm', status: 500 }).isClientError()).toBe(
			false,
		);
		const noStatus = new ForgeError({ code: 'UNKNOWN_ERROR', message: 'm' });
		expect(noStatus.isClientError()).toBe(false);
		expect(noStatus.isServerError()).toBe(false);
	});

	it('withMeta merges meta and preserves the message key', () => {
		const e = new ForgeError({
			code: 'CONFLICT',
			message: 'm',
			userMessage: 'k',
			status: 409,
			meta: { a: 1 },
		});
		const merged = e.withMeta({ b: 2 });
		expect(merged.meta).toEqual({ a: 1, b: 2 });
		expect(merged.userMessage).toBe('k');
		expect(merged.status).toBe(409);
		expect(merged).not.toBe(e);
	});

	it('toJSON serializes the structured fields with an ISO timestamp', () => {
		const e = new ForgeError({ code: 'NOT_FOUND', message: 'm', status: 404 });
		const json = e.toJSON();
		expect(json.code).toBe('NOT_FOUND');
		expect(json.status).toBe(404);
		expect(json.name).toBe('ForgeError');
		expect(typeof json.timestampISO).toBe('string');
		expect(json.timestampISO).toMatch(/T.*Z$/);
	});

	it('invokes the global error monitor hook on construction', () => {
		const hook = vi.fn();
		setErrorMonitorHook(hook);
		const e = new ForgeError({ code: 'UNKNOWN_ERROR', message: 'm' });
		expect(hook).toHaveBeenCalledTimes(1);
		expect(hook).toHaveBeenCalledWith(e);
	});

	it('exposes ErrorCodes constants', () => {
		expect(ErrorCodes.FORBIDDEN).toBe('FORBIDDEN');
		expect(Object.keys(ErrorCodes)).toContain('NETWORK_ERROR');
	});
});
