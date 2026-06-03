import { afterEach, describe, expect, it, vi } from 'vitest';
import { getBaseDomain, getBrand, getEnv, getDomain, getFullURL } from '../../http/index.js';

function stubLocation(href: string) {
	vi.stubGlobal('window', { location: { href } });
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('http/url', () => {
	it('getBaseDomain returns the last two hostname labels', () => {
		stubLocation('https://app.staging.example.com/path');
		expect(getBaseDomain()).toBe('example.com');
	});

	it('getBrand picks the second-to-last label for a multi-part host', () => {
		stubLocation('https://staging.acme.com');
		expect(getBrand()).toBe('acme');
	});

	it('getBrand returns the single label for a one-part host', () => {
		stubLocation('https://localhost');
		expect(getBrand()).toBe('localhost');
	});

	it('getBrand returns the first label for a two-part host', () => {
		stubLocation('https://acme.com');
		expect(getBrand()).toBe('acme');
	});

	it('getEnv returns the leading label for a 3-part host', () => {
		stubLocation('https://prod.acme.com');
		expect(getEnv()).toBe('prod');
	});

	it('getEnv joins the first two labels for a 5-part host', () => {
		stubLocation('https://eu.prod.acme.co.uk');
		expect(getEnv()).toBe('eu.prod');
	});

	it('getEnv returns empty string for a 2-part host', () => {
		stubLocation('https://acme.com');
		expect(getEnv()).toBe('');
	});

	it('getDomain returns the TLD label', () => {
		stubLocation('https://prod.acme.com');
		expect(getDomain()).toBe('com');
	});

	it('getDomain returns empty string for a single-label host', () => {
		stubLocation('https://localhost');
		expect(getDomain()).toBe('');
	});

	it('getFullURL composes env.brand.domain', () => {
		stubLocation('https://prod.acme.com');
		expect(getFullURL()).toBe('prod.acme.com');
	});
});
