import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	JsonStorage,
	MemoryStorage,
	WebStorageAdapter,
	createSafeStorage,
	type SafeStorage,
} from '../../storage/index.js';

describe('MemoryStorage', () => {
	it('round-trips items + reports length', () => {
		const s = new MemoryStorage();
		s.setItem('a', '1');
		s.setItem('b', '2');
		expect(s.length).toBe(2);
		expect(s.getItem('a')).toBe('1');
		expect(s.getItem('missing')).toBeNull();
	});

	it('key(i) returns the nth key, null when out of range', () => {
		const s = new MemoryStorage();
		s.setItem('a', '1');
		s.setItem('b', '2');
		expect(s.key(0)).toBe('a');
		expect(s.key(1)).toBe('b');
		expect(s.key(99)).toBeNull();
	});

	it('removeItem + clear', () => {
		const s = new MemoryStorage();
		s.setItem('a', '1');
		s.removeItem('a');
		expect(s.getItem('a')).toBeNull();
		s.setItem('b', '2');
		s.clear();
		expect(s.length).toBe(0);
	});
});

describe('WebStorageAdapter — error safety', () => {
	function throwingStorage(): Storage {
		const fail = () => {
			throw new Error('quota');
		};
		return {
			get length(): number {
				throw new Error('length');
			},
			clear: fail,
			getItem: fail,
			key: fail,
			removeItem: fail,
			setItem: fail,
		} as unknown as Storage;
	}

	it('swallows every kind of underlying error and returns safe defaults', () => {
		const s: SafeStorage = new WebStorageAdapter(throwingStorage());
		expect(s.length).toBe(0);
		expect(s.getItem('x')).toBeNull();
		expect(s.key(0)).toBeNull();
		expect(() => s.setItem('a', '1')).not.toThrow();
		expect(() => s.removeItem('a')).not.toThrow();
		expect(() => s.clear()).not.toThrow();
	});

	it('delegates to a working Storage', () => {
		const mem = new MemoryStorage();
		const s = new WebStorageAdapter(mem as unknown as Storage);
		s.setItem('k', 'v');
		expect(s.getItem('k')).toBe('v');
	});
});

describe('createSafeStorage', () => {
	const originalLocal = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
	const originalSession = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');

	afterEach(() => {
		if (originalLocal) Object.defineProperty(globalThis, 'localStorage', originalLocal);
		else delete (globalThis as { localStorage?: Storage }).localStorage;
		if (originalSession) Object.defineProperty(globalThis, 'sessionStorage', originalSession);
		else delete (globalThis as { sessionStorage?: Storage }).sessionStorage;
	});

	it('uses WebStorageAdapter when localStorage exists', () => {
		const mem = new MemoryStorage();
		Object.defineProperty(globalThis, 'localStorage', {
			value: mem,
			configurable: true,
			writable: true,
		});
		const s = createSafeStorage('local');
		s.setItem('k', 'v');
		expect(mem.getItem('k')).toBe('v');
	});

	it('falls back to MemoryStorage when localStorage is absent (SSR/Node)', () => {
		delete (globalThis as { localStorage?: Storage }).localStorage;
		const s = createSafeStorage('local');
		s.setItem('k', 'v');
		expect(s.getItem('k')).toBe('v');
	});

	it('switches to sessionStorage when kind=session', () => {
		const mem = new MemoryStorage();
		Object.defineProperty(globalThis, 'sessionStorage', {
			value: mem,
			configurable: true,
			writable: true,
		});
		const s = createSafeStorage('session');
		s.setItem('k', 'v');
		expect(mem.getItem('k')).toBe('v');
	});
});

describe('JsonStorage', () => {
	let storage: MemoryStorage;
	let json: JsonStorage;

	beforeEach(() => {
		storage = new MemoryStorage();
		json = new JsonStorage(storage);
	});

	it('round-trips objects via JSON', () => {
		json.set('user', { id: 1, name: 'alice' });
		expect(json.get('user')).toEqual({ id: 1, name: 'alice' });
	});

	it('returns the fallback when missing', () => {
		expect(json.get('missing', { id: 0 })).toEqual({ id: 0 });
		expect(json.get('missing')).toBeUndefined();
	});

	it('returns the fallback on malformed JSON instead of throwing', () => {
		storage.setItem('broken', '{not json');
		expect(json.get('broken', null)).toBeNull();
	});

	it('remove + clear delegate to the underlying storage', () => {
		json.set('a', 1);
		json.set('b', 2);
		json.remove('a');
		expect(json.get('a')).toBeUndefined();
		json.clear();
		expect(storage.length).toBe(0);
	});
});
