import {
	Decoder,
	Encoder,
	HttpMethod,
	ListResponse,
	Search,
	getResourceConfig,
	type IResource,
	type ModelType,
	type QueryOption,
} from '../jsonapi/index.js';
import { ApiError, NetworkError, parseJsonApiErrors } from './errors.js';
import {
	type HttpAdapter,
	type HttpRequest,
	type HttpResponse,
	FetchAdapter,
} from './http-adapter.js';
import { appendSearch, joinPath } from './url-builder.js';

const JSON_API_MEDIA_TYPE = 'application/vnd.api+json';
const ATOMIC_MEDIA_TYPE = `${JSON_API_MEDIA_TYPE};ext="https://jsonapi.org/ext/atomic"`;

export type HeaderFactory = Record<string, string> | (() => Record<string, string>);

export interface ApiClientOptions {
	baseUrl: string;
	adapter?: HttpAdapter;
	headers?: HeaderFactory;
	/** Append a trailing path before resource paths (e.g. '/v1'). */
	basePath?: string;
	credentials?: 'include' | 'omit' | 'same-origin';
}

export interface CallOptions {
	signal?: AbortSignal;
	headers?: Record<string, string>;
}

interface ResolvedConfig {
	baseUrl: string;
	basePath: string;
	adapter: HttpAdapter;
	headerFactory: () => Record<string, string>;
	credentials?: 'include' | 'omit' | 'same-origin';
}

function resolveHeaders(h?: HeaderFactory): () => Record<string, string> {
	if (!h) return () => ({});
	if (typeof h === 'function') return h;
	return () => h;
}

function resourcePath<R extends IResource>(modelType: ModelType<R>): string {
	const cfg = getResourceConfig(modelType);
	if (!cfg) throw new Error(`@JsonApi decorator missing on ${modelType.name}`);
	return cfg.type;
}

/**
 * Instantiate a model and populate it from a partial. Resource's own
 * constructor only handles id/lid/timestamps — Object.assign hydrates the
 * @Attribute()-decorated fields so consumers don't need to write a
 * per-class constructor.
 */
export function instantiate<R extends IResource>(modelType: ModelType<R>, attrs: Partial<R>): R {
	const instance = new modelType(attrs as Record<string, unknown>);
	Object.assign(instance, attrs);
	return instance;
}

export class ApiClient {
	private constructor(private readonly cfg: ResolvedConfig) {}

	static create(opts: ApiClientOptions): ApiClient {
		return new ApiClient({
			baseUrl: opts.baseUrl.replace(/\/+$/, ''),
			basePath: opts.basePath ?? '',
			adapter: opts.adapter ?? new FetchAdapter(),
			headerFactory: resolveHeaders(opts.headers),
			credentials: opts.credentials,
		});
	}

	with(overrides: Partial<ApiClientOptions>): ApiClient {
		return new ApiClient({
			...this.cfg,
			baseUrl: (overrides.baseUrl ?? this.cfg.baseUrl).replace(/\/+$/, ''),
			basePath: overrides.basePath ?? this.cfg.basePath,
			adapter: overrides.adapter ?? this.cfg.adapter,
			headerFactory: overrides.headers ? resolveHeaders(overrides.headers) : this.cfg.headerFactory,
			credentials: overrides.credentials ?? this.cfg.credentials,
		});
	}

	// ──────────────── CRUD ────────────────

	async list<R extends IResource>(
		modelType: ModelType<R>,
		...args: (QueryOption | CallOptions)[]
	): Promise<ListResponse<R>> {
		const { queryOpts, callOpts } = splitArgs(args);
		const url = appendSearch(this.url(resourcePath(modelType)), maybeSearch(queryOpts));
		const res = await this.send({
			method: HttpMethod.Get,
			url,
			headers: this.headers(),
			signal: callOpts.signal,
		});
		this.throwIfErrors(res);
		const doc = new Decoder<R>(modelType).DecodeCollection(res.body as object);
		return new ListResponse<R>(doc.Data(), doc.Meta(), doc.Included());
	}

	async get<R extends IResource>(
		modelType: ModelType<R>,
		id: string,
		...args: (QueryOption | CallOptions)[]
	): Promise<R> {
		const { queryOpts, callOpts } = splitArgs(args);
		const url = appendSearch(this.url(resourcePath(modelType), id), maybeSearch(queryOpts));
		const res = await this.send({
			method: HttpMethod.Get,
			url,
			headers: this.headers(),
			signal: callOpts.signal,
		});
		this.throwIfErrors(res);
		const doc = new Decoder<R>(modelType).Decode(res.body as object);
		return doc.Data() as R;
	}

	async create<R extends IResource>(
		modelType: ModelType<R>,
		attrs: Partial<R>,
		callOpts: CallOptions = {},
	): Promise<R> {
		const instance = instantiate(modelType, attrs);
		const doc = new Encoder<R>().Encode(instance, Encoder.encodeAsClient(HttpMethod.Post));
		const res = await this.send({
			method: HttpMethod.Post,
			url: this.url(resourcePath(modelType)),
			headers: this.headers(callOpts.headers),
			body: doc,
			signal: callOpts.signal,
		});
		this.throwIfErrors(res);
		const decoded = new Decoder<R>(modelType).Decode(res.body as object);
		return decoded.Data() as R;
	}

	async update<R extends IResource>(
		modelType: ModelType<R>,
		id: string,
		attrs: Partial<R>,
		callOpts: CallOptions = {},
	): Promise<R> {
		const instance = instantiate(modelType, { ...attrs, id } as Partial<R>);
		const doc = new Encoder<R>().Encode(instance, Encoder.encodeAsClient(HttpMethod.Patch));
		const res = await this.send({
			method: HttpMethod.Patch,
			url: this.url(resourcePath(modelType), id),
			headers: this.headers(callOpts.headers),
			body: doc,
			signal: callOpts.signal,
		});
		this.throwIfErrors(res);
		const decoded = new Decoder<R>(modelType).Decode(res.body as object);
		return decoded.Data() as R;
	}

	async delete<R extends IResource>(
		modelType: ModelType<R>,
		id: string,
		callOpts: CallOptions = {},
	): Promise<void> {
		const res = await this.send({
			method: HttpMethod.Delete,
			url: this.url(resourcePath(modelType), id),
			headers: this.headers(callOpts.headers),
			signal: callOpts.signal,
		});
		if (res.status >= 200 && res.status < 300) return;
		throw new ApiError(res.status, parseJsonApiErrors(res.body));
	}

	// ──────────────── Multipart upload ────────────────

	async createWithFormData<R extends IResource>(
		modelType: ModelType<R>,
		body: FormData,
		callOpts: CallOptions = {},
	): Promise<R> {
		const headers = this.headers(callOpts.headers);
		// Browser sets multipart boundary automatically; never set Content-Type manually.
		delete headers['Content-Type'];
		const res = await this.send({
			method: HttpMethod.Post,
			url: this.url(resourcePath(modelType)),
			headers,
			body,
			signal: callOpts.signal,
		});
		this.throwIfErrors(res);
		const decoded = new Decoder<R>(modelType).Decode(res.body as object);
		return decoded.Data() as R;
	}

	// ──────────────── Bulk (non-atomic) ────────────────

	async bulkCreate<R extends IResource>(
		modelType: ModelType<R>,
		payloads: Partial<R>[],
		callOpts: CallOptions = {},
	): Promise<R[]> {
		const instances = payloads.map((p) => instantiate(modelType, p));
		const doc = new Encoder<R>().EncodeCollection(
			instances,
			Encoder.encodeAsClient(HttpMethod.Post),
		);
		const res = await this.send({
			method: HttpMethod.Post,
			url: this.url(resourcePath(modelType)),
			headers: this.headers(callOpts.headers),
			body: doc,
			signal: callOpts.signal,
		});
		this.throwIfErrors(res);
		const decoded = new Decoder<R>(modelType).DecodeCollection(res.body as object);
		return decoded.Data() as R[];
	}

	async bulkUpdate<R extends IResource>(
		modelType: ModelType<R>,
		payloads: (Partial<R> & { id: string })[],
		callOpts: CallOptions = {},
	): Promise<R[]> {
		const instances = payloads.map((p) => instantiate(modelType, p as Partial<R>));
		const doc = new Encoder<R>().EncodeCollection(
			instances,
			Encoder.encodeAsClient(HttpMethod.Patch),
		);
		const res = await this.send({
			method: HttpMethod.Patch,
			url: this.url(resourcePath(modelType)),
			headers: this.headers(callOpts.headers),
			body: doc,
			signal: callOpts.signal,
		});
		this.throwIfErrors(res);
		const decoded = new Decoder<R>(modelType).DecodeCollection(res.body as object);
		return decoded.Data() as R[];
	}

	async bulkDelete<R extends IResource>(
		modelType: ModelType<R>,
		ids: string[],
		callOpts: CallOptions = {},
	): Promise<void> {
		const body = {
			data: ids.map((id) => ({ type: resourcePath(modelType), id })),
		};
		const res = await this.send({
			method: HttpMethod.Delete,
			url: this.url(resourcePath(modelType)),
			headers: this.headers(callOpts.headers),
			body,
			signal: callOpts.signal,
		});
		if (res.status >= 200 && res.status < 300) return;
		throw new ApiError(res.status, parseJsonApiErrors(res.body));
	}

	// ──────────────── Escape hatch ────────────────

	async request<T = unknown>(
		req: Omit<HttpRequest, 'url' | 'headers'> & { path: string; headers?: Record<string, string> },
	): Promise<HttpResponse & { typed?: T }> {
		const res = await this.send({
			method: req.method,
			url: this.url(req.path),
			headers: this.headers(req.headers),
			body: req.body,
			signal: req.signal,
		});
		if (res.status >= 400) throw new ApiError(res.status, parseJsonApiErrors(res.body));
		return res as HttpResponse & { typed?: T };
	}

	// ──────────────── Atomic ────────────────

	async atomic(ops: AtomicOpInternal[], callOpts: CallOptions = {}): Promise<AtomicResult> {
		if (ops.length === 0) return { results: [] };
		const body = { 'atomic:operations': ops.map((o) => o.toWire()) };
		const headers = this.headers(callOpts.headers);
		headers['Content-Type'] = ATOMIC_MEDIA_TYPE;
		headers['Accept'] = ATOMIC_MEDIA_TYPE;
		const res = await this.send({
			method: HttpMethod.Post,
			url: this.url('/operations'),
			headers,
			body,
			signal: callOpts.signal,
		});
		if (res.status >= 400) {
			throw new ApiError(res.status, parseJsonApiErrors(res.body));
		}
		const raw = (res.body as { 'atomic:results'?: { data?: unknown }[] } | null) ?? {};
		const rawResults = raw['atomic:results'] ?? [];
		const results: (object | null)[] = rawResults.map((entry, i) => {
			const op = ops[i];
			if (!entry || entry.data === null || entry.data === undefined) return null;
			if (!op.modelType) return entry.data as object;
			const decoded = new Decoder(op.modelType).Decode({ data: entry.data } as object);
			return decoded.Data() as object;
		});
		return { results };
	}

	// ──────────────── Internals ────────────────

	private url(...parts: string[]): string {
		return joinPath(this.cfg.baseUrl, this.cfg.basePath, ...parts);
	}

	private headers(extra: Record<string, string> = {}): Record<string, string> {
		return {
			Accept: JSON_API_MEDIA_TYPE,
			'Content-Type': JSON_API_MEDIA_TYPE,
			...this.cfg.headerFactory(),
			...extra,
		};
	}

	private async send(req: HttpRequest): Promise<HttpResponse> {
		try {
			return await this.cfg.adapter.request({ credentials: this.cfg.credentials, ...req });
		} catch (e) {
			if (e instanceof DOMException && e.name === 'AbortError') throw e;
			if (e instanceof NetworkError) throw e;
			throw new NetworkError(e instanceof Error ? e.message : 'transport error', e);
		}
	}

	private throwIfErrors(res: HttpResponse): void {
		if (res.status >= 200 && res.status < 300) return;
		throw new ApiError(res.status, parseJsonApiErrors(res.body));
	}
}

function splitArgs(args: (QueryOption | CallOptions)[]): {
	queryOpts: QueryOption[];
	callOpts: CallOptions;
} {
	const queryOpts: QueryOption[] = [];
	let callOpts: CallOptions = {};
	for (const a of args) {
		if (typeof a === 'function') queryOpts.push(a);
		else callOpts = { ...callOpts, ...a };
	}
	return { queryOpts, callOpts };
}

function maybeSearch(queryOpts: QueryOption[]): Search | undefined {
	if (queryOpts.length === 0) return undefined;
	return new Search(Search.withQueryOptions(...queryOpts));
}

// Re-declared here to break a circular type dep with atomic.ts.
export interface AtomicOpInternal {
	modelType?: ModelType<IResource>;
	toWire(): Record<string, unknown>;
}

export interface AtomicResult {
	results: (object | null)[];
}
