export type AtomListener<T> = (next: T, prev: T) => void;
export type Unsubscribe = () => void;

/**
 * Minimal observable value: get/set/update + subscribe. Framework adapters
 * (Vue ref, Angular signal, …) wrap an Atom to bridge into their reactivity.
 */
export class Atom<T> {
	private value: T;
	private readonly listeners = new Set<AtomListener<T>>();

	constructor(initial: T) {
		this.value = initial;
	}

	get(): T {
		return this.value;
	}

	set(next: T): void {
		if (Object.is(next, this.value)) return;
		const prev = this.value;
		this.value = next;
		for (const l of this.listeners) l(next, prev);
	}

	update(fn: (curr: T) => T): void {
		this.set(fn(this.value));
	}

	subscribe(listener: AtomListener<T>): Unsubscribe {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}
}
