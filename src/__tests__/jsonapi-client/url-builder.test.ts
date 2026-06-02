import { describe, expect, it } from 'vitest';
import { joinPath } from '../../jsonapi-client';

describe('joinPath', () => {
	it('keeps a root-absolute path when baseUrl is empty', () => {
		// Regression: an empty baseUrl used to drop the leading slash, yielding a
		// relative URL the browser resolves against the current route.
		expect(joinPath('', '/api', '/auth/logout')).toBe('/api/auth/logout');
		expect(joinPath('', '/api')).toBe('/api');
	});

	it('joins an absolute baseUrl with paths', () => {
		expect(joinPath('/api/proxy/aegis', '', '/pets')).toBe('/api/proxy/aegis/pets');
		expect(joinPath('/base/', '/v1/', '/x/')).toBe('/base/v1/x');
	});

	it('preserves full URLs', () => {
		expect(joinPath('https://api.example.com', '/v1', 'pets')).toBe(
			'https://api.example.com/v1/pets',
		);
	});

	it('leaves genuinely relative joins relative', () => {
		expect(joinPath('api', 'v1')).toBe('api/v1');
	});

	it('handles empty/whitespace parts', () => {
		expect(joinPath('', '', '/users/me')).toBe('/users/me');
		expect(joinPath('')).toBe('');
	});
});
