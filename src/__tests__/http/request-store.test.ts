import { afterEach, describe, expect, it } from 'vitest';
import { requestStore } from '../../http/index.js';

afterEach(() => {
	requestStore.cancelAll();
});

describe('requestStore', () => {
	it('creates and tracks an AbortController', () => {
		const c = requestStore.create('a');
		expect(c).toBeInstanceOf(AbortController);
		expect(requestStore.size).toBe(1);
	});

	it('aborts a previous controller when the same id is recreated', () => {
		const first = requestStore.create('dup');
		const second = requestStore.create('dup');
		expect(first.signal.aborted).toBe(true);
		expect(second.signal.aborted).toBe(false);
		expect(requestStore.size).toBe(1);
	});

	it('remove() deletes without aborting', () => {
		const c = requestStore.create('r');
		requestStore.remove('r');
		expect(c.signal.aborted).toBe(false);
		expect(requestStore.size).toBe(0);
	});

	it('cancel() aborts and removes a specific request', () => {
		const c = requestStore.create('x');
		requestStore.cancel('x');
		expect(c.signal.aborted).toBe(true);
		expect(requestStore.size).toBe(0);
	});

	it('cancel() is a no-op for an unknown id', () => {
		expect(() => requestStore.cancel('missing')).not.toThrow();
	});

	it('cancelAll() aborts every tracked request and clears the store', () => {
		const a = requestStore.create('a');
		const b = requestStore.create('b');
		requestStore.cancelAll();
		expect(a.signal.aborted).toBe(true);
		expect(b.signal.aborted).toBe(true);
		expect(requestStore.size).toBe(0);
	});
});
