import { MemoryStorage } from './memory-storage.js';
import { type SafeStorage, WebStorageAdapter } from './safe-storage.js';

export type StorageKind = 'local' | 'session';

function browserStorage(kind: StorageKind): Storage | null {
	if (typeof globalThis === 'undefined') return null;
	const g = globalThis as { localStorage?: Storage; sessionStorage?: Storage };
	return (kind === 'local' ? g.localStorage : g.sessionStorage) ?? null;
}

/**
 * Returns a SafeStorage backed by the requested Web Storage. Falls back to
 * MemoryStorage when not in a browser (SSR, Node tests) so callers don't
 * have to branch on platform.
 */
export function createSafeStorage(kind: StorageKind = 'local'): SafeStorage {
	const native = browserStorage(kind);
	return native ? new WebStorageAdapter(native) : new MemoryStorage();
}
