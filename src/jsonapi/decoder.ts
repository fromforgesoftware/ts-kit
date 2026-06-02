import { type AttributeProperty, getAttributeProperties } from './decorators/attribute.decorator.js';
import { getLinkProperties } from './decorators/link.decorator.js';
import { type MetaProperty, getMetaProperties } from './decorators/meta.decorator.js';
import { getRelationshipProperties } from './decorators/relationship.decorator.js';
import { Document, type IDocument, type IncludedResources, includedKey } from './document.js';
import { ListResponse } from './model/list-response.js';
import { type ModelType } from './model/model.js';
import { type IResource } from './model/resource.js';
import { type resource } from './resource.js';

// ============================================================================
// Decoder
// ============================================================================

export class Decoder<R extends IResource> {
	private _modelType: ModelType<R>;

	constructor(modelType: ModelType<R>) {
		this._modelType = modelType;
	}

	public Decode(data: object): IDocument<R> {
		if (!data) return null;

		const doc = new Document<R>(data);

		if ((doc.Errors() && doc.Errors().length > 0) || !doc.data) {
			return doc;
		}

		const included = this.buildIncludedMap(doc);
		doc.wdata = deserialize(this._modelType, doc.data as resource, included);

		return doc;
	}

	public DecodeCollection(data: object): IDocument<R[]> {
		if (!data) return null;

		const doc = new Document<R[]>(data);

		if (doc.Errors() && doc.Errors().length > 0) {
			return doc;
		}

		const included = this.buildIncludedMap(doc);
		doc.wdata = (doc.data as resource[]).map((d) => deserialize(this._modelType, d, included));

		return doc;
	}

	private buildIncludedMap(doc: Document<unknown>): IncludedResources | undefined {
		if (!doc.included) return undefined;
		return new Map(doc.included.map((r) => [includedKey(r), r]));
	}
}

// ============================================================================
// Response decoders — framework-agnostic.
// ============================================================================

/**
 * Framework-agnostic response shape consumed by the document decoders.
 * Maps cleanly onto:
 *   - axios:           { status, data }   → { status, body: data }
 *   - fetch Response:  { status, body }   → await res.json() for body
 *   - Angular HttpResponse: { status, body }
 *
 * The decoder switches on status, NOT on event type — Angular's HttpEvent
 * streaming model is not modelled here. Angular consumers filter for
 * HttpEventType.Response upstream and pass the materialised body.
 */
export interface IDecodableResponse {
	status: number;
	body: unknown;
}

export type resDecoder<O> = (res: IDecodableResponse) => O;

export const newSingleDocResponseDecoder = <R extends IResource>(
	modelType: ModelType<R>,
): resDecoder<R> => {
	return (res: IDecodableResponse): R => {
		if (res.status === 204) return null;

		const d = new Decoder<R>(modelType).Decode(res.body as object);

		if (res.status < 200 || res.status >= 300) {
			throw new Error(d?.Errors()?.[0]?.Detail() ?? `jsonapi error: status ${res.status}`);
		}

		return d?.Data() as R;
	};
};

export const newCollectionDocResponseDecoder = <R extends IResource>(
	modelType: ModelType<R>,
): resDecoder<ListResponse<R>> => {
	return (res: IDecodableResponse): ListResponse<R> => {
		const d = new Decoder<R>(modelType).DecodeCollection(res.body as object);

		if (res.status !== 200 && res.status !== 201) {
			throw new Error(d?.Errors()?.[0]?.Detail() ?? `jsonapi error: status ${res.status}`);
		}

		return new ListResponse<R>(d.Data(), d.Meta(), d.Included());
	};
};

// ============================================================================
// Recursive resource deserialisation.
// ============================================================================

const deserialize = <R>(
	modelType: ModelType<R>,
	data: resource,
	included?: IncludedResources,
): R => {
	const out = new modelType() as unknown as Record<string, unknown>;

	// Identity
	out['id'] = data.ID();
	if (data.LID()) out['lid'] = data.LID();
	out['type'] = data.Type();

	// Attributes (primitive + recursive)
	const attrProps = getAttributeProperties(modelType.prototype as object);
	const rawAttrs = data.Attributes();
	if (rawAttrs) {
		for (const serializedName of Object.keys(attrProps)) {
			const prop = attrProps[serializedName];
			const raw = rawAttrs.get(serializedName);
			if (raw === undefined || raw === null) continue;
			out[String(prop.key)] = decodeAttributeValue(raw, prop);
		}
	}

	// Meta (primitive + recursive)
	const metaProps = getMetaProperties(modelType.prototype as object);
	const rawMeta = data.Meta();
	if (rawMeta) {
		for (const serializedName of Object.keys(metaProps)) {
			const prop = metaProps[serializedName];
			const raw = rawMeta.get(serializedName);
			if (raw === undefined || raw === null) continue;
			out[String(prop.key)] = decodeMetaValue(raw, prop);
		}
	}

	// Links — store the URL or link-object as-is (consumers usually
	// dereference it without further parsing).
	const linkProps = getLinkProperties(modelType.prototype as object);
	const rawLinks = (data as resource).Links?.();
	if (rawLinks) {
		for (const serializedName of Object.keys(linkProps)) {
			const prop = linkProps[serializedName];
			const raw = rawLinks.get(serializedName);
			if (raw === undefined || raw === null) continue;
			out[String(prop.key)] = raw;
		}
	}

	// Relationships — resolve through `included` lookup map when available.
	const relProps = getRelationshipProperties(modelType.prototype as object);
	const rawRels = data.Relationships();
	if (rawRels) {
		for (const serializedName of Object.keys(relProps)) {
			const rel = rawRels.get(serializedName);
			if (!rel) continue;
			const relProp = relProps[serializedName];
			const relData = rel.Data();

			if (Array.isArray(relData)) {
				out[String(relProp.key)] = relData.map((el) =>
					resolveRelationship(relProp.target, el, included),
				);
			} else if (relData && typeof relData === 'object') {
				out[String(relProp.key)] = resolveRelationship(relProp.target, relData, included);
			} else if (relData === null) {
				out[String(relProp.key)] = null;
			}
		}
	}

	return out as unknown as R;
};

const decodeAttributeValue = (raw: unknown, prop: AttributeProperty): unknown => {
	// Recursive sub-class? Decode into an instance of the target type.
	if (prop.type) {
		if (Array.isArray(raw)) {
			return raw.map((item) => deserializeRaw(prop.type!, item));
		}
		if (raw && typeof raw === 'object' && !(raw instanceof Date)) {
			return deserializeRaw(prop.type, raw);
		}
		// Fall through for primitives; preserved as-is.
	}

	// Plain object that isn't a Date → wrap in a Map (current behaviour for
	// freeform JSON sub-trees). Otherwise pass primitives + arrays through.
	if (prop.transformer) {
		return prop.transformer.deserialize(raw);
	}
	if (raw && typeof raw === 'object' && !Array.isArray(raw) && !(raw instanceof Date)) {
		return new Map(Object.entries(raw as Record<string, unknown>));
	}
	return raw;
};

const decodeMetaValue = (raw: unknown, prop: MetaProperty): unknown => {
	if (prop.type) {
		if (Array.isArray(raw)) {
			return raw.map((item) => deserializeRaw(prop.type!, item));
		}
		if (raw && typeof raw === 'object' && !(raw instanceof Date)) {
			return deserializeRaw(prop.type, raw);
		}
	}
	return raw;
};

/**
 * Recursive helper for typed sub-attributes / sub-meta — decodes a raw
 * JSON object into an instance of the target class using its own
 * `@Attribute` / `@Meta` metadata. The target class doesn't need to be
 * a Resource (no id/type required); useful for nested value types like
 * Timestamps, Address, Coordinates, etc.
 */
const deserializeRaw = <T>(modelType: ModelType<T>, raw: unknown): T => {
	const out = new modelType() as unknown as Record<string, unknown>;
	if (!raw || typeof raw !== 'object') return out as unknown as T;

	const rawObj = raw as Record<string, unknown>;
	const attrProps = getAttributeProperties(modelType.prototype as object);
	for (const serializedName of Object.keys(attrProps)) {
		const prop = attrProps[serializedName];
		const value = rawObj[serializedName];
		if (value === undefined || value === null) continue;
		out[String(prop.key)] = decodeAttributeValue(value, prop);
	}
	return out as unknown as T;
};

const resolveRelationship = <R>(
	target: ModelType<R>,
	el: { id?: string; lid?: string; type?: string },
	included?: IncludedResources,
): R => {
	const id = el.id ?? el.lid ?? '';
	const type = el.type ?? '';
	const incl = included?.get(`${type}:${id}`);
	if (incl) return deserialize(target, incl, included);
	const stub = new target() as unknown as Record<string, unknown>;
	stub['id'] = id;
	if (el.lid) stub['lid'] = el.lid;
	stub['type'] = type;
	return stub as unknown as R;
};
