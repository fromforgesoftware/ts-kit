import { NetworkError } from './errors.js';

export interface HttpRequest {
	method: string;
	url: string;
	headers: Record<string, string>;
	body?: unknown;
	signal?: AbortSignal;
	/** Cookie policy for the underlying transport (e.g. 'include' for sessions). */
	credentials?: 'include' | 'omit' | 'same-origin';
}

export interface HttpResponse {
	status: number;
	headers: Record<string, string>;
	body: unknown;
}

export interface HttpAdapter {
	request(req: HttpRequest): Promise<HttpResponse>;
}

/**
 * Zero-dependency adapter using native `fetch`. Adapters for axios or Angular
 * HttpClient live in vue-kit / angular-kit so this kit stays dep-free.
 */
export class FetchAdapter implements HttpAdapter {
	async request(req: HttpRequest): Promise<HttpResponse> {
		const isFormData = typeof FormData !== 'undefined' && req.body instanceof FormData;
		const init: RequestInit = {
			method: req.method,
			headers: req.headers,
			signal: req.signal,
		};
		if (req.credentials) init.credentials = req.credentials;
		if (req.body !== undefined && req.body !== null) {
			init.body = isFormData ? (req.body as FormData) : JSON.stringify(req.body);
		}

		let res: Response;
		try {
			res = await fetch(req.url, init);
		} catch (e) {
			if (e instanceof DOMException && e.name === 'AbortError') throw e;
			throw new NetworkError(e instanceof Error ? e.message : 'fetch failed', e);
		}

		const body = await readBody(res);
		const headers: Record<string, string> = {};
		res.headers.forEach((v, k) => {
			headers[k] = v;
		});
		return { status: res.status, headers, body };
	}
}

async function readBody(res: Response): Promise<unknown> {
	if (res.status === 204) return null;
	const ct = res.headers.get('content-type') ?? '';
	if (ct.includes('json')) {
		try {
			return await res.json();
		} catch {
			return null;
		}
	}
	return res.text();
}
