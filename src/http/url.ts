/**
 * URL utilities for environment detection and URL reconstruction.
 * Ported from v1: packages/shared/src/utils/http/url/url.ts
 */

export function getBaseDomain(): string {
	const hostname = new URL(window.location.href).hostname;
	return hostname.split('.').slice(-2).join('.');
}

export function getBrand(): string {
	const url = new URL(window.location.href);
	const parts = url.hostname.split('.');
	switch (parts.length) {
		case 1:
			return parts[0];
		case 2:
			return parts[0];
		default:
			return parts[parts.length - 2];
	}
}

export function getEnv(): string {
	const url = new URL(window.location.href);
	const parts = url.hostname.split('.');
	switch (parts.length) {
		case 3:
			return parts[0];
		case 4:
			return parts[0];
		case 5:
			return [parts[0], parts[1]].join('.');
		default:
			return '';
	}
}

export function getDomain(): string {
	const url = new URL(window.location.href);
	const parts = url.hostname.split('.');
	if (parts.length <= 1) return '';
	return parts[parts.length - 1];
}

export function getFullURL(): string {
	return [getEnv(), getBrand(), getDomain()].join('.');
}
