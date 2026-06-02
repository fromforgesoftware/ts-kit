import { type ErrorSource, type IError, jsonapiError } from './errors.js';
import { type ILinks } from './links.js';
import { type IMeta } from './meta.js';
import { type IResourceObject, resource, type resourceIdentifier } from './resource.js';
import { type ISpec, type Spec } from './spec.js';

export const specVersion = '1.1';

/**
 * `IDocument<T>` is the JSON:API top-level document. The wrapped data
 * `T` is the deserialised resource (or list) — for compound documents,
 * `Included()` exposes the `included` array and `IncludedMap()` gives a
 * `type:id`-keyed lookup the consumer can use to chase relationships.
 *
 * Spec § Top Level: a document MUST contain at least one of `data`,
 * `errors`, `meta`, or an extension-defined member. `data` and `errors`
 * MUST NOT coexist.
 */
export interface IDocument<T> {
	Data(): T;
	Errors(): IError[];
	Meta(): IMeta;
	Spec(): ISpec;
	Links(): ILinks;
	Included(): IResourceObject[];
	IncludedMap(): IncludedResources;
}

export type IncludedResources = Map<string, resource>;

/**
 * Single helper used by both encoder + decoder to key `included` resources.
 * Uses `type:id` separator to avoid the collision the pre-rewrite key had
 * (`${id}${type}` collided when string-concatenation overlapped — e.g.
 * `id:'ab', type:'cd'` vs `id:'a', type:'bcd'`).
 *
 * Accepts either a `resource` instance (decoder path, accessors via
 * `.Type()/.ID()`) or a plain object with `type`/`id` fields (encoder path,
 * where serialised resources are bare Records before being attached to a
 * Document).
 */
export const includedKey = (
	r: resource | resourceIdentifier | { id?: string; type?: string },
): string => {
	if (typeof (r as { Type?: () => string }).Type === 'function') {
		const typed = r as resource | resourceIdentifier;
		return `${typed.Type()}:${typed.ID()}`;
	}
	const raw = r as { id?: string; type?: string };
	return `${raw.type ?? ''}:${raw.id ?? ''}`;
};

export class Document<T> {
	jsonapi: Spec;
	links: ILinks;
	meta: IMeta;
	data: resource | resource[];
	wdata: T;
	included: resource[];
	errors: IError[];

	constructor(data?: unknown) {
		if (!data || typeof data !== 'object') return;
		const d = data as Record<string, unknown>;

		this.jsonapi = d['jsonapi'] as Spec;

		if (d['links']) {
			this.links =
				d['links'] instanceof Map
					? (d['links'] as ILinks)
					: (new Map(Object.entries(d['links'] as Record<string, unknown>)) as ILinks);
		}
		if (d['meta']) {
			this.meta =
				d['meta'] instanceof Map
					? (d['meta'] as IMeta)
					: (new Map(Object.entries(d['meta'] as Record<string, unknown>)) as IMeta);
		}
		if (d['data']) {
			if (Array.isArray(d['data'])) {
				this.data = (d['data'] as Array<unknown>).map((x) => new resource(x));
			} else {
				this.data = new resource(d['data']);
			}
		}
		this.included = d['included']
			? (d['included'] as Array<unknown>).map((i) => new resource(i))
			: undefined;
		if (Array.isArray(d['errors'])) {
			this.errors = (d['errors'] as Array<Record<string, unknown>>).map((e) => new jsonapiError(e));
		}
	}

	Spec(): ISpec {
		return this.jsonapi;
	}
	Links(): ILinks {
		return this.links;
	}
	Meta(): IMeta {
		return this.meta;
	}
	Data(): T {
		return this.wdata;
	}
	Included(): IResourceObject[] {
		return this.included ? (this.included as IResourceObject[]) : null;
	}

	/**
	 * Type:id-keyed lookup over the `included` array. Built once on first
	 * call (the underlying array is immutable after construction).
	 * Returns an empty Map when there's no `included` member rather than
	 * null, so callers can chain `.get()` without a guard.
	 */
	private _includedMap?: IncludedResources;
	IncludedMap(): IncludedResources {
		if (this._includedMap) return this._includedMap;
		if (!this.included) {
			this._includedMap = new Map();
			return this._includedMap;
		}
		this._includedMap = new Map(this.included.map((r) => [includedKey(r), r]));
		return this._includedMap;
	}

	Errors(): IError[] {
		return this.errors;
	}
}

// Re-export ErrorSource so consumers don't have to dig into ./errors directly.
export type { ErrorSource };
