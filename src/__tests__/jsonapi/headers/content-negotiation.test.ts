import { describe, expect, it } from 'vitest';
import {
	MEDIA_TYPE,
	buildAcceptHeader,
	buildContentTypeHeader,
	parseMediaType,
} from '../../../jsonapi';

describe('content negotiation helpers', () => {
	it('emits the bare media type when no params are given', () => {
		expect(buildAcceptHeader()).toBe(MEDIA_TYPE);
		expect(buildContentTypeHeader()).toBe(MEDIA_TYPE);
	});

	it('emits ext + profile when supplied', () => {
		const header = buildAcceptHeader({
			ext: ['https://jsonapi.org/ext/atomic'],
			profile: ['http://example.com/profile/x'],
		});
		expect(header).toContain('application/vnd.api+json');
		expect(header).toContain('ext="https://jsonapi.org/ext/atomic"');
		expect(header).toContain('profile="http://example.com/profile/x"');
	});

	it('parses ext + profile back out of a header value', () => {
		const parsed = parseMediaType(
			'application/vnd.api+json; ext="https://jsonapi.org/ext/atomic"; profile="x y"',
		);
		expect(parsed).not.toBeNull();
		expect(parsed!.ext).toEqual(['https://jsonapi.org/ext/atomic']);
		expect(parsed!.profile).toEqual(['x', 'y']);
	});

	it('returns null for non-JSON:API media types', () => {
		expect(parseMediaType('application/json')).toBeNull();
		expect(parseMediaType('')).toBeNull();
	});
});
