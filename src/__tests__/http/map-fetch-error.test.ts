import { describe, expect, it } from 'vitest';
import { mapFetchError, mapResponseError } from '../../http/index.js';
import { ForgeError } from '../../errors/index.js';

describe('mapFetchError', () => {
	it('passes through an existing ForgeError', () => {
		const original = new ForgeError({ code: 'NOT_FOUND', message: 'm' });
		expect(mapFetchError(original, 'ctx')).toBe(original);
	});

	it('wraps an Error as a NETWORK_ERROR with context prefix', () => {
		const e = mapFetchError(new Error('connection refused'), 'fetchUser');
		expect(e.code).toBe('NETWORK_ERROR');
		expect(e.message).toBe('fetchUser: connection refused');
		expect(e.retryable).toBe(true);
	});

	it('wraps a non-error value', () => {
		const e = mapFetchError('offline', 'ctx');
		expect(e.code).toBe('NETWORK_ERROR');
		expect(e.message).toBe('ctx: offline');
	});
});

describe('mapResponseError', () => {
	function fakeResponse(status: number, statusText: string, url = 'https://api/x'): Response {
		return { status, statusText, url } as Response;
	}

	it('maps a known status to its error code with url meta', () => {
		const e = mapResponseError(fakeResponse(404, 'Not Found'), 'getThing');
		expect(e.code).toBe('NOT_FOUND');
		expect(e.status).toBe(404);
		expect(e.message).toBe('getThing: 404 Not Found');
		expect(e.meta.url).toBe('https://api/x');
	});

	it('maps 422 to VALIDATION_ERROR', () => {
		expect(mapResponseError(fakeResponse(422, 'Unprocessable'), 'ctx').code).toBe(
			'VALIDATION_ERROR',
		);
	});

	it('falls back to UNKNOWN_ERROR for an unmapped status', () => {
		expect(mapResponseError(fakeResponse(418, "I'm a teapot"), 'ctx').code).toBe('UNKNOWN_ERROR');
	});
});
