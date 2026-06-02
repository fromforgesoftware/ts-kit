import type { Search } from '../jsonapi/index.js';

export function joinPath(...parts: string[]): string {
	const joined = parts
		.map((p, i) => {
			if (i === 0) return p.replace(/\/+$/, '');
			return p.replace(/^\/+/, '').replace(/\/+$/, '');
		})
		.filter(Boolean)
		.join('/');
	if (!joined) return joined;
	// An empty leading baseUrl must not turn an absolute basePath/path into a
	// relative URL (which the browser would resolve against the current route).
	// If the first non-empty part was root-absolute and the result isn't already
	// absolute or a full URL, restore the leading slash.
	const firstNonEmpty = parts.find((p) => p !== '') ?? '';
	const absolute = joined.startsWith('/') || /^[a-z][a-z0-9+.-]*:\/\//i.test(joined);
	return firstNonEmpty.startsWith('/') && !absolute ? `/${joined}` : joined;
}

export function appendSearch(url: string, search?: Search): string {
	if (!search) return url;
	const params = search.toString();
	if (!params) return url;
	return `${url}${url.includes('?') ? '&' : '?'}${params}`;
}
