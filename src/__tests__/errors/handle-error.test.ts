import { afterEach, describe, expect, it, vi } from 'vitest';
import { createErrorHandler, toErrorInfo, ForgeError, isForbidden } from '../../errors/index.js';

afterEach(() => {
	vi.restoreAllMocks();
});

describe('toErrorInfo', () => {
	it('maps a ForgeError preserving code/status/messages', () => {
		const e = new ForgeError({
			code: 'NOT_FOUND',
			message: 'tech',
			userMessage: 'user msg',
			status: 404,
		});
		const info = toErrorInfo(e);
		expect(info.code).toBe('NOT_FOUND');
		expect(info.status).toBe(404);
		expect(info.message).toBe('tech');
		expect(info.userMessage).toBe('user msg');
		expect(info.original).toBe(e);
	});

	it('falls back to a status message when ForgeError has no userMessage', () => {
		const e = new ForgeError({ code: 'NOT_FOUND', message: 'tech', userMessage: '', status: 404 });
		const info = toErrorInfo(e);
		expect(info.userMessage).toBe('The requested resource does not exist.');
	});

	it('falls back to a generic message for an unknown status', () => {
		const e = new ForgeError({ code: 'UNKNOWN_ERROR', message: 'tech', userMessage: '' });
		expect(toErrorInfo(e).userMessage).toBe('Something went wrong.');
	});

	it('maps a plain Error to UNKNOWN_ERROR', () => {
		const info = toErrorInfo(new Error('boom'));
		expect(info.code).toBe('UNKNOWN_ERROR');
		expect(info.message).toBe('boom');
		expect(info.retryable).toBe(false);
	});

	it('maps a non-error value', () => {
		const info = toErrorInfo('weird');
		expect(info.code).toBe('UNKNOWN_ERROR');
		expect(info.message).toBe('weird');
	});
});

describe('createErrorHandler', () => {
	it('calls toast, onError, and returns the info', () => {
		const toast = vi.fn();
		const onError = vi.fn();
		vi.spyOn(console, 'error').mockImplementation(() => undefined);
		const { handleError } = createErrorHandler({ toast, onError });

		const info = handleError(
			new ForgeError({ code: 'CONFLICT', message: 'm', userMessage: 'conflict!' }),
		);

		expect(toast).toHaveBeenCalledWith('conflict!');
		expect(onError).toHaveBeenCalledWith(info);
		expect(info.code).toBe('CONFLICT');
	});

	it('respects showToast=false', () => {
		const toast = vi.fn();
		vi.spyOn(console, 'error').mockImplementation(() => undefined);
		const { handleError } = createErrorHandler({ toast, showToast: false });
		handleError(new ForgeError({ code: 'NOT_FOUND', message: 'm' }));
		expect(toast).not.toHaveBeenCalled();
	});

	it('respects log=false (no logger output)', () => {
		const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		const { handleError } = createErrorHandler({ log: false });
		handleError(new Error('m'));
		expect(errSpy).not.toHaveBeenCalled();
	});

	it('logs by default', () => {
		const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		const { handleError } = createErrorHandler({});
		handleError(new ForgeError({ code: 'SERVER_ERROR', message: 'down', status: 500 }));
		expect(errSpy).toHaveBeenCalled();
	});

	it('exposes toErrorInfo on the returned handler', () => {
		const { toErrorInfo: helper } = createErrorHandler();
		expect(helper(new Error('x')).code).toBe('UNKNOWN_ERROR');
	});
});

describe('isForbidden', () => {
	it('is true for a ForgeError with status 403', () => {
		expect(isForbidden(new ForgeError({ code: 'FORBIDDEN', message: 'm', status: 403 }))).toBe(true);
	});

	it('is false for a ForgeError with another status', () => {
		expect(isForbidden(new ForgeError({ code: 'NOT_FOUND', message: 'm', status: 404 }))).toBe(
			false,
		);
	});

	it('is true for a plain object with status 403', () => {
		expect(isForbidden({ status: 403 })).toBe(true);
	});

	it('is false for objects without a 403 status and for primitives', () => {
		expect(isForbidden({ status: 500 })).toBe(false);
		expect(isForbidden(null)).toBe(false);
		expect(isForbidden('403')).toBe(false);
		expect(isForbidden(undefined)).toBe(false);
	});
});
