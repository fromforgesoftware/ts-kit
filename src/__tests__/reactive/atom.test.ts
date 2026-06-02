import { describe, expect, it, vi } from 'vitest';
import { Atom } from '../../reactive/index.js';

describe('Atom', () => {
	it('reads/writes', () => {
		const a = new Atom(1);
		expect(a.get()).toBe(1);
		a.set(2);
		expect(a.get()).toBe(2);
	});

	it('notifies subscribers on change with next + prev', () => {
		const a = new Atom(1);
		const listener = vi.fn();
		a.subscribe(listener);
		a.set(2);
		expect(listener).toHaveBeenCalledWith(2, 1);
	});

	it('skips notification when Object.is(next, prev)', () => {
		const a = new Atom({ k: 1 });
		const listener = vi.fn();
		a.subscribe(listener);
		a.set(a.get());
		expect(listener).not.toHaveBeenCalled();
	});

	it('update() applies a transformation', () => {
		const a = new Atom(1);
		a.update((n) => n + 1);
		expect(a.get()).toBe(2);
	});

	it('unsubscribe stops further notifications', () => {
		const a = new Atom(1);
		const listener = vi.fn();
		const off = a.subscribe(listener);
		off();
		a.set(2);
		expect(listener).not.toHaveBeenCalled();
	});
});
