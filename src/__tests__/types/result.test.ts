import { afterEach, describe, expect, it, vi } from 'vitest';
import { ok, err, tryCatch, configureTryCatch } from '../../types/index.js';
import { ForgeError } from '../../errors/index.js';

describe('Result constructors', () => {
	it('ok() returns [data, null]', () => {
		expect(ok(42)).toEqual([42, null]);
		expect(ok({ a: 1 })).toEqual([{ a: 1 }, null]);
	});

	it('err() returns [null, error]', () => {
		const e = new Error('boom');
		expect(err(e)).toEqual([null, e]);
	});
});

describe('tryCatch', () => {
	afterEach(() => {
		// Reset global notifier between tests by configuring a no-op then restoring.
		configureTryCatch({ onError: () => undefined });
		vi.restoreAllMocks();
	});

	it('returns ok tuple on success', async () => {
		const [data, error] = await tryCatch(async () => 'value');
		expect(error).toBeNull();
		expect(data).toBe('value');
	});

	it('wraps a thrown plain Error into a ForgeError', async () => {
		const [data, error] = await tryCatch(async () => {
			throw new Error('kaboom');
		});
		expect(data).toBeNull();
		expect(error).toBeInstanceOf(ForgeError);
		expect(error?.code).toBe('UNKNOWN_ERROR');
		expect(error?.message).toBe('kaboom');
	});

	it('wraps a thrown non-Error value', async () => {
		const [, error] = await tryCatch(async () => {
			throw 'string failure';
		});
		expect(error).toBeInstanceOf(ForgeError);
		expect(error?.message).toBe('string failure');
	});

	it('passes through an existing ForgeError unchanged', async () => {
		const original = new ForgeError({ code: 'NOT_FOUND', message: 'nope' });
		const [, error] = await tryCatch(async () => {
			throw original;
		});
		expect(error).toBe(original);
	});

	it('invokes the global error notifier for non-cancelled errors', async () => {
		const onError = vi.fn();
		configureTryCatch({ onError });
		await tryCatch(async () => {
			throw new Error('notify me');
		});
		expect(onError).toHaveBeenCalledTimes(1);
		expect(onError.mock.calls[0][0]).toBeInstanceOf(ForgeError);
	});

	it('stays silent for cancelled errors (meta.cancelled)', async () => {
		const onError = vi.fn();
		configureTryCatch({ onError });
		const cancelled = new ForgeError({
			code: 'UNKNOWN_ERROR',
			message: 'cancelled',
			meta: { cancelled: true },
		});
		await tryCatch(async () => {
			throw cancelled;
		});
		expect(onError).not.toHaveBeenCalled();
	});
});
