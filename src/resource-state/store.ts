import { Atom, type AtomListener, type Unsubscribe } from '../reactive/index.js';
import type { SafeStorage } from '../storage/index.js';
import type { IdAccessor, Pagination, ResourceState } from './types.js';

const DEFAULT_LIMIT = 10;
const SELECTED_KEY = 'selectedId';

function defaultIdAccessor<R>(resource: R): string {
	const r = resource as unknown as { id?: unknown; ID?: () => string };
	if (typeof r.ID === 'function') return r.ID();
	if (typeof r.id === 'string') return r.id;
	if (typeof r.id === 'number') return String(r.id);
	throw new Error('ResourceStore: no idAccessor provided and resource lacks `id` / `ID()`');
}

export interface ResourceStoreOptions<R> {
	initialLimit?: number;
	idAccessor?: IdAccessor<R>;
	/** When set, the selected resource id is persisted across reloads. */
	storage?: SafeStorage;
	storageKey?: string;
}

export class ResourceStore<R> {
	private readonly atom: Atom<ResourceState<R>>;
	private readonly idOf: IdAccessor<R>;
	private readonly storage: SafeStorage | undefined;
	private readonly storageKey: string;
	private readonly initial: ResourceState<R>;

	constructor(opts: ResourceStoreOptions<R> = {}) {
		this.idOf = opts.idAccessor ?? defaultIdAccessor;
		this.storage = opts.storage;
		this.storageKey = opts.storageKey ?? SELECTED_KEY;
		this.initial = {
			items: [],
			selected: null,
			pagination: {
				totalCount: 0,
				page: 0,
				limit: opts.initialLimit ?? DEFAULT_LIMIT,
			},
			loading: false,
			error: null,
		};
		this.atom = new Atom<ResourceState<R>>(this.initial);
	}

	// ──────────── reads ────────────

	state(): ResourceState<R> {
		return this.atom.get();
	}

	items(): R[] {
		return this.atom.get().items;
	}

	selected(): R | null {
		return this.atom.get().selected;
	}

	pagination(): Pagination {
		return this.atom.get().pagination;
	}

	loading(): boolean {
		return this.atom.get().loading;
	}

	error(): string | null {
		return this.atom.get().error;
	}

	findById(id: string): R | undefined {
		return this.atom.get().items.find((r) => this.idOf(r) === id);
	}

	canLoadMore(): boolean {
		const s = this.atom.get();
		if (s.items.length === 0) return true;
		return s.items.length < s.pagination.totalCount;
	}

	// ──────────── writes ────────────

	setItems(items: R[], pagination?: Partial<Pagination>): void {
		this.atom.update((s) => ({
			...s,
			items,
			pagination: pagination ? { ...s.pagination, ...pagination } : s.pagination,
		}));
	}

	appendItems(items: R[]): void {
		if (items.length === 0) return;
		this.atom.update((s) => ({
			...s,
			items: [...s.items, ...items],
			pagination: {
				...s.pagination,
				totalCount: Math.max(s.pagination.totalCount, s.items.length + items.length),
			},
		}));
	}

	upsertItem(item: R): void {
		const id = this.idOf(item);
		this.atom.update((s) => {
			const idx = s.items.findIndex((r) => this.idOf(r) === id);
			if (idx === -1) {
				return {
					...s,
					items: [...s.items, item],
					pagination: { ...s.pagination, totalCount: s.pagination.totalCount + 1 },
				};
			}
			const next = [...s.items];
			next[idx] = item;
			return { ...s, items: next };
		});
	}

	updateItem(item: R): void {
		const id = this.idOf(item);
		this.atom.update((s) => ({
			...s,
			items: s.items.map((r) => (this.idOf(r) === id ? item : r)),
		}));
	}

	removeItem(item: R): void {
		this.removeItemById(this.idOf(item));
	}

	removeItemById(id: string): void {
		this.atom.update((s) => {
			const next = s.items.filter((r) => this.idOf(r) !== id);
			if (next.length === s.items.length) return s;
			return {
				...s,
				items: next,
				selected: s.selected && this.idOf(s.selected) === id ? null : s.selected,
				pagination: {
					...s.pagination,
					totalCount: Math.max(0, s.pagination.totalCount - 1),
				},
			};
		});
	}

	select(item: R | null): void {
		this.atom.update((s) => ({ ...s, selected: item }));
		if (!this.storage) return;
		if (item) this.storage.setItem(this.storageKey, this.idOf(item));
		else this.storage.removeItem(this.storageKey);
	}

	selectById(id: string): void {
		const found = this.findById(id) ?? null;
		this.select(found);
	}

	setLoading(loading: boolean): void {
		this.atom.update((s) => ({ ...s, loading }));
	}

	setError(error: string | null): void {
		this.atom.update((s) => ({ ...s, error }));
	}

	setPagination(pagination: Partial<Pagination>): void {
		this.atom.update((s) => ({ ...s, pagination: { ...s.pagination, ...pagination } }));
	}

	nextPage(): number {
		const next = this.atom.get().pagination.page + 1;
		this.setPagination({ page: next });
		return next;
	}

	reset(): void {
		this.atom.set(this.initial);
	}

	// ──────────── subscriptions ────────────

	subscribe(listener: AtomListener<ResourceState<R>>): Unsubscribe {
		return this.atom.subscribe(listener);
	}

	/**
	 * Restore the persisted selection from storage, if any. Call this after
	 * the initial items load. No-op when no storage was provided.
	 */
	restoreSelectionFromStorage(): void {
		if (!this.storage) return;
		const id = this.storage.getItem(this.storageKey);
		if (!id) return;
		const found = this.findById(id);
		if (found) this.atom.update((s) => ({ ...s, selected: found }));
	}
}
