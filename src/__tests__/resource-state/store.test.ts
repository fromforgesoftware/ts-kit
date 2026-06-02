import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryStorage } from '../../storage/index.js';
import { ResourceStore } from '../../resource-state/index.js';

interface User {
	id: string;
	name: string;
}

const a: User = { id: 'a', name: 'Alice' };
const b: User = { id: 'b', name: 'Bob' };
const c: User = { id: 'c', name: 'Carla' };

describe('ResourceStore — reads', () => {
	let store: ResourceStore<User>;

	beforeEach(() => {
		store = new ResourceStore<User>();
	});

	it('starts empty with default pagination', () => {
		expect(store.items()).toEqual([]);
		expect(store.selected()).toBeNull();
		expect(store.pagination()).toEqual({ totalCount: 0, page: 0, limit: 10 });
		expect(store.loading()).toBe(false);
		expect(store.error()).toBeNull();
	});

	it('honours initialLimit', () => {
		const s = new ResourceStore<User>({ initialLimit: 50 });
		expect(s.pagination().limit).toBe(50);
	});

	it('findById returns the matching item or undefined', () => {
		store.setItems([a, b]);
		expect(store.findById('a')).toEqual(a);
		expect(store.findById('missing')).toBeUndefined();
	});

	it('canLoadMore is true when empty', () => {
		expect(store.canLoadMore()).toBe(true);
	});

	it('canLoadMore is false when items.length === totalCount', () => {
		store.setItems([a, b], { totalCount: 2 });
		expect(store.canLoadMore()).toBe(false);
	});

	it('canLoadMore is true when more pages remain', () => {
		store.setItems([a], { totalCount: 3 });
		expect(store.canLoadMore()).toBe(true);
	});
});

describe('ResourceStore — writes', () => {
	let store: ResourceStore<User>;

	beforeEach(() => {
		store = new ResourceStore<User>();
	});

	it('setItems replaces items + merges pagination', () => {
		store.setItems([a, b], { totalCount: 10, page: 1 });
		expect(store.items()).toEqual([a, b]);
		expect(store.pagination()).toEqual({ totalCount: 10, page: 1, limit: 10 });
	});

	it('appendItems concatenates and grows totalCount when needed', () => {
		store.setItems([a]);
		store.appendItems([b, c]);
		expect(store.items().map((u) => u.id)).toEqual(['a', 'b', 'c']);
		expect(store.pagination().totalCount).toBeGreaterThanOrEqual(3);
	});

	it('appendItems is a no-op when given an empty list', () => {
		store.setItems([a]);
		store.appendItems([]);
		expect(store.items()).toEqual([a]);
	});

	it('upsertItem inserts when missing, updates when present', () => {
		store.upsertItem(a);
		store.upsertItem({ id: 'a', name: 'Alice2' });
		expect(store.items()).toEqual([{ id: 'a', name: 'Alice2' }]);
		expect(store.pagination().totalCount).toBe(1);
	});

	it('updateItem replaces by id, does nothing if id unknown', () => {
		store.setItems([a, b]);
		store.updateItem({ id: 'a', name: 'Alice2' });
		expect(store.items().find((u) => u.id === 'a')).toEqual({ id: 'a', name: 'Alice2' });
		store.updateItem({ id: 'missing', name: '?' });
		expect(store.items().some((u) => u.id === 'missing')).toBe(false);
	});

	it('removeItem strips by id, decrements totalCount, clears selection', () => {
		store.setItems([a, b], { totalCount: 2 });
		store.select(a);
		store.removeItem(a);
		expect(store.items()).toEqual([b]);
		expect(store.selected()).toBeNull();
		expect(store.pagination().totalCount).toBe(1);
	});

	it('removeItemById removes a specific item but keeps selection if unrelated', () => {
		store.setItems([a, b], { totalCount: 2 });
		store.select(a);
		store.removeItemById('b');
		expect(store.selected()).toEqual(a);
	});

	it('setLoading + setError', () => {
		store.setLoading(true);
		store.setError('boom');
		expect(store.loading()).toBe(true);
		expect(store.error()).toBe('boom');
	});

	it('nextPage increments and returns the new page', () => {
		const p1 = store.nextPage();
		const p2 = store.nextPage();
		expect(p1).toBe(1);
		expect(p2).toBe(2);
		expect(store.pagination().page).toBe(2);
	});

	it('reset restores the initial state', () => {
		store.setItems([a, b], { totalCount: 2, page: 3 });
		store.setLoading(true);
		store.reset();
		expect(store.items()).toEqual([]);
		expect(store.pagination()).toEqual({ totalCount: 0, page: 0, limit: 10 });
		expect(store.loading()).toBe(false);
	});
});

describe('ResourceStore — selection + storage persistence', () => {
	it('select persists id when storage is provided, clears on null', () => {
		const storage = new MemoryStorage();
		const store = new ResourceStore<User>({ storage });
		store.setItems([a, b]);
		store.select(b);
		expect(storage.getItem('selectedId')).toBe('b');
		store.select(null);
		expect(storage.getItem('selectedId')).toBeNull();
	});

	it('selectById finds in current items', () => {
		const store = new ResourceStore<User>();
		store.setItems([a, b]);
		store.selectById('b');
		expect(store.selected()).toEqual(b);
	});

	it('restoreSelectionFromStorage rehydrates the selection if the item is loaded', () => {
		const storage = new MemoryStorage();
		storage.setItem('selectedId', 'b');
		const store = new ResourceStore<User>({ storage });
		store.setItems([a, b]);
		store.restoreSelectionFromStorage();
		expect(store.selected()).toEqual(b);
	});

	it('restoreSelectionFromStorage is a no-op when storage missing', () => {
		const store = new ResourceStore<User>();
		store.setItems([a, b]);
		store.restoreSelectionFromStorage();
		expect(store.selected()).toBeNull();
	});

	it('respects a custom storageKey', () => {
		const storage = new MemoryStorage();
		const store = new ResourceStore<User>({ storage, storageKey: 'user/sel' });
		store.setItems([a]);
		store.select(a);
		expect(storage.getItem('user/sel')).toBe('a');
	});
});

describe('ResourceStore — id accessors', () => {
	it('falls back to resource.id', () => {
		const store = new ResourceStore<User>();
		store.upsertItem(a);
		expect(store.findById('a')).toEqual(a);
	});

	it('uses a custom idAccessor when provided', () => {
		const store = new ResourceStore<{ uuid: string }>({
			idAccessor: (r) => r.uuid,
		});
		store.upsertItem({ uuid: 'u-1' });
		expect(store.findById('u-1')).toEqual({ uuid: 'u-1' });
	});

	it('calls ID() when present (ts-jsonapi IResource style)', () => {
		class JsonApiResource {
			constructor(private readonly _id: string) {}
			ID(): string {
				return this._id;
			}
		}
		const store = new ResourceStore<JsonApiResource>();
		const r = new JsonApiResource('x');
		store.upsertItem(r);
		expect(store.findById('x')).toBe(r);
	});

	it('throws a clear error when neither id nor ID() exists', () => {
		const store = new ResourceStore<{ name: string }>();
		expect(() => store.upsertItem({ name: 'no-id' })).toThrow(/idAccessor/);
	});
});

describe('ResourceStore — subscriptions', () => {
	it('subscribers receive the new state', () => {
		const store = new ResourceStore<User>();
		const listener = vi.fn();
		store.subscribe(listener);
		store.setItems([a]);
		expect(listener).toHaveBeenCalled();
		const [next] = listener.mock.calls[0];
		expect(next.items).toEqual([a]);
	});
});
