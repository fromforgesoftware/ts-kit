import type { SafeStorage } from './safe-storage.js';

/**
 * Typed JSON view over a SafeStorage. Reads/writes go through JSON.parse /
 * JSON.stringify, with a guarded fallback when the stored payload is missing
 * or malformed.
 */
export class JsonStorage {
	constructor(private readonly storage: SafeStorage) {}

	get<T>(key: string, fallback: T): T;
	get<T>(key: string): T | undefined;
	get<T>(key: string, fallback?: T): T | undefined {
		const raw = this.storage.getItem(key);
		if (raw === null) return fallback;
		try {
			return JSON.parse(raw) as T;
		} catch {
			return fallback;
		}
	}

	set<T>(key: string, value: T): void {
		this.storage.setItem(key, JSON.stringify(value));
	}

	remove(key: string): void {
		this.storage.removeItem(key);
	}

	clear(): void {
		this.storage.clear();
	}
}
