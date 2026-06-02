// JSON:API §Content Negotiation helpers.
//
// Spec requires the media type `application/vnd.api+json` and forbids
// any media-type parameters other than `ext` and `profile`. These
// helpers build conforming `Accept` and `Content-Type` strings.

import { MEDIA_TYPE } from './spec';

export interface ContentNegotiationOptions {
	/** Extension URIs, e.g. ['https://jsonapi.org/ext/atomic']. */
	ext?: string[];
	/** Profile URIs, e.g. ['http://example.com/profiles/cursor-pagination']. */
	profile?: string[];
}

/**
 * Build an `Accept` header value. Per spec § Servers, a client MUST set
 * the `ext` parameter when it requires a specific extension and MAY use
 * `profile` to indicate optional profile support.
 *
 *   buildAcceptHeader({ ext: ['https://jsonapi.org/ext/atomic'] })
 *     → 'application/vnd.api+json; ext="https://jsonapi.org/ext/atomic"'
 */
export const buildAcceptHeader = (opts: ContentNegotiationOptions = {}): string => {
	return assembleMediaType(opts);
};

/**
 * Build a `Content-Type` header value. Spec § Clients: when sending a
 * request body the `Content-Type` MUST be the JSON:API media type.
 */
export const buildContentTypeHeader = (opts: ContentNegotiationOptions = {}): string => {
	return assembleMediaType(opts);
};

const assembleMediaType = (opts: ContentNegotiationOptions): string => {
	const parts: string[] = [MEDIA_TYPE];
	if (opts.ext && opts.ext.length > 0) {
		parts.push(`ext="${opts.ext.join(' ')}"`);
	}
	if (opts.profile && opts.profile.length > 0) {
		parts.push(`profile="${opts.profile.join(' ')}"`);
	}
	return parts.join('; ');
};

/**
 * Parse the parameters off an incoming `Content-Type` or `Accept` header.
 * Returns `null` if the media type doesn't match `application/vnd.api+json`
 * (the caller should reject the request per spec § Servers).
 */
export const parseMediaType = (value: string): ContentNegotiationOptions | null => {
	if (!value) return null;
	const parts = value.split(';').map((p) => p.trim());
	if (parts[0] !== MEDIA_TYPE) return null;
	const out: ContentNegotiationOptions = {};
	for (const part of parts.slice(1)) {
		const [k, vRaw] = part.split('=');
		if (!k || !vRaw) continue;
		const v = vRaw.replace(/^"|"$/g, '');
		const items = v.split(/\s+/);
		if (k === 'ext') out.ext = items;
		else if (k === 'profile') out.profile = items;
	}
	return out;
};
