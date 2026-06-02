/**
 * Dual-storage helper: cookies + localStorage.
 *
 * Used for persisting data that needs to survive across tabs (localStorage)
 * and be accessible by SSR/edge middleware (cookies).
 */

const DEFAULT_COOKIE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

export function setCookie(
	name: string,
	value: unknown,
	expiryMs: number = DEFAULT_COOKIE_EXPIRY_MS,
): void {
	const expires = new Date(Date.now() + expiryMs).toUTCString();
	const maxAge = Math.floor(expiryMs / 1000);
	document.cookie = `${name}=${encodeURIComponent(
		JSON.stringify(value),
	)};path=/;SameSite=Lax;max-age=${maxAge};expires=${expires}`;
}

export function getCookie(name: string): string | null {
	const value = `; ${document.cookie}`;
	const parts = value.split(`; ${name}=`);
	if (parts.length === 2) {
		const cookieValue = parts.pop()?.split(';').shift();
		return cookieValue ? decodeURIComponent(cookieValue) : null;
	}
	return null;
}

export function removeCookie(name: string): void {
	document.cookie = `${name}=;path=/;max-age=0;expires=${new Date(0).toUTCString()}`;
}

/**
 * Set a value in both localStorage and cookies for redundancy.
 */
export function setDualStorage(key: string, value: unknown, cookieExpiryMs?: number): void {
	localStorage.setItem(key, JSON.stringify(value));
	setCookie(key, value, cookieExpiryMs);
}

/**
 * Get a value from cookies first (fresher across tabs), falling back to localStorage.
 */
export function getDualStorage(key: string): string | null {
	return getCookie(key) || localStorage.getItem(key);
}

/**
 * Remove a value from both localStorage and cookies.
 */
export function removeDualStorage(key: string): void {
	localStorage.removeItem(key);
	removeCookie(key);
}

/**
 * Parse a JSON value from dual storage, returning a fallback on failure.
 */
export function getDualStorageParsed<T>(key: string, fallback: T): T {
	const raw = getDualStorage(key);
	if (!raw) return fallback;
	try {
		return JSON.parse(raw) as T;
	} catch {
		return fallback;
	}
}
