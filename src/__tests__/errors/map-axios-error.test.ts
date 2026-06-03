import { describe, expect, it } from 'vitest';
import { mapAxiosError, extractValidationErrors, ForgeError } from '../../errors/index.js';

function axiosError(overrides: Record<string, unknown>) {
	return { isAxiosError: true, message: 'Request failed', ...overrides };
}

describe('mapAxiosError', () => {
	it('maps a cancelled request to an UNKNOWN_ERROR with empty userMessage', () => {
		const e = mapAxiosError(axiosError({ code: 'ERR_CANCELED' }));
		expect(e.code).toBe('UNKNOWN_ERROR');
		expect(e.userMessage).toBe('');
		expect(e.meta.cancelled).toBe(true);
	});

	it('maps known HTTP statuses to error codes', () => {
		expect(mapAxiosError(axiosError({ response: { status: 400 } })).code).toBe('VALIDATION_ERROR');
		expect(mapAxiosError(axiosError({ response: { status: 401 } })).code).toBe('UNAUTHORIZED');
		expect(mapAxiosError(axiosError({ response: { status: 403 } })).code).toBe('FORBIDDEN');
		expect(mapAxiosError(axiosError({ response: { status: 404 } })).code).toBe('NOT_FOUND');
		expect(mapAxiosError(axiosError({ response: { status: 409 } })).code).toBe('CONFLICT');
		expect(mapAxiosError(axiosError({ response: { status: 500 } })).code).toBe('SERVER_ERROR');
	});

	it('falls back to NETWORK_ERROR for an unmapped/absent status', () => {
		expect(mapAxiosError(axiosError({ response: { status: 418 } })).code).toBe('NETWORK_ERROR');
		expect(mapAxiosError(axiosError({})).code).toBe('NETWORK_ERROR');
	});

	it('passes through server message + operationId + url into the ForgeError', () => {
		const e = mapAxiosError(
			axiosError({
				config: { url: '/v1/things' },
				response: {
					status: 422,
					data: {
						error: { message: 'errors.invalidThing' },
						metadata: { operationID: 'op-123' },
					},
				},
			}),
		);
		expect(e.code).toBe('VALIDATION_ERROR');
		expect(e.status).toBe(422);
		expect(e.message).toBe('errors.invalidThing');
		expect(e.userMessage).toBe('errors.invalidThing');
		expect(e.meta.url).toBe('/v1/things');
		expect(e.meta.operationId).toBe('op-123');
	});

	it('maps a plain Error to UNKNOWN_ERROR', () => {
		const e = mapAxiosError(new Error('boom'));
		expect(e.code).toBe('UNKNOWN_ERROR');
		expect(e.message).toBe('boom');
	});

	it('maps an unknown non-error value to UNKNOWN_ERROR', () => {
		const e = mapAxiosError('weird');
		expect(e.code).toBe('UNKNOWN_ERROR');
		expect(e.message).toBe('weird');
	});

	it('treats objects with a response property as axios-like', () => {
		const e = mapAxiosError({ response: { status: 404 }, message: 'nf' });
		expect(e.code).toBe('NOT_FOUND');
	});
});

describe('extractValidationErrors', () => {
	it('extracts field errors from an axios response', () => {
		const v = extractValidationErrors(
			axiosError({ response: { status: 422, data: { errors: { name: 'required' } } } }),
		);
		expect(v.getError('name' as never)).toBe('required');
	});

	it('returns an empty ValidationError for non-axios errors', () => {
		const v = extractValidationErrors(new Error('x'));
		expect(v.hasErrors()).toBe(false);
	});
});

describe('errors barrel exports', () => {
	it('re-exports ForgeError', () => {
		expect(new ForgeError({ code: 'NOT_FOUND', message: 'm' })).toBeInstanceOf(ForgeError);
	});
});
