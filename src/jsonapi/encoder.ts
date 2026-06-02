import { type AttributeProperty, getAttributeProperties } from './decorators/attribute.decorator';
import { getLinkProperties } from './decorators/link.decorator';
import { type MetaProperty, getMetaProperties } from './decorators/meta.decorator';
import { getRelationshipProperties } from './decorators/relationship.decorator';
import { getResourceConfig } from './decorators/resource.decorator';
import { Document, type IDocument, includedKey } from './document';
import { HttpMethod } from './http/constants';
import { type IMeta } from './meta';
import { type ModelType } from './model/model';
import { type IResource } from './model/resource';
import { relationship } from './relationships';
import { type resource, resourceIdentifier } from './resource';

// ============================================================================
// EncoderConfig — toggles for client (sending) vs server (responding).
// ============================================================================

const defaultEncoderConfigOpts = (): EncoderOpt[] => {
	return [Encoder.encodeAsClient(HttpMethod.Post)];
};

export class EncoderConfig {
	/** Skip the `id` on the outgoing resource (POST creates from client). */
	mustHaveEmptyId = false;
	/** Skip server-managed timestamps. */
	mustHaveEmptyTimestamps = false;
	/** Embed relationship targets as `included`. */
	mapIncluded = false;
	/** Optional top-level meta (e.g. pagination counts on collection responses). */
	rootMeta?: Record<string, unknown>;

	constructor(...opts: EncoderOpt[]) {
		for (const opt of [...defaultEncoderConfigOpts(), ...opts]) {
			opt(this);
		}
	}
}

export type EncoderOpt = (c: EncoderConfig) => void;

// ============================================================================
// Encoder
// ============================================================================

export class Encoder<R extends IResource> {
	public Encode(res: R, ...opts: EncoderOpt[]): IDocument<R> {
		if (!res) return null;
		const modelType = res.constructor as ModelType<R>;
		return serialize(modelType, res, ...opts);
	}

	public EncodeCollection(resources: R[], ...opts: EncoderOpt[]): IDocument<R[]> {
		if (!resources) return null;
		const modelType = resources[0]?.constructor as ModelType<R>;
		return serializeCollection(modelType, resources, ...opts);
	}

	/**
	 * Client-side encoding: strip the id on POST (server assigns it),
	 * strip server-managed timestamps on writes, never embed `included`.
	 */
	static encodeAsClient = (method: string): EncoderOpt => {
		return (c: EncoderConfig) => {
			c.mustHaveEmptyId = method === HttpMethod.Post;
			c.mustHaveEmptyTimestamps =
				method === HttpMethod.Patch ||
				method === HttpMethod.Delete ||
				method === HttpMethod.Post ||
				method === HttpMethod.Put;
			c.mapIncluded = false;
		};
	};

	/** Server-side encoding: keep id + timestamps, embed `included`. */
	static encodeAsServer = (): EncoderOpt => {
		return (c: EncoderConfig) => {
			c.mustHaveEmptyId = false;
			c.mustHaveEmptyTimestamps = false;
			c.mapIncluded = true;
		};
	};

	static encodeWithRootMeta = (rootMeta: Record<string, unknown>): EncoderOpt => {
		return (c: EncoderConfig) => {
			c.rootMeta = rootMeta;
		};
	};
}

// ============================================================================
// Recursive resource serialisation.
// ============================================================================

const serialize = <R extends IResource>(
	modelType: ModelType<R>,
	data: R,
	...opts: EncoderOpt[]
): Document<R> => {
	const config = new EncoderConfig(...opts);
	const resourceConfig = getResourceConfig(modelType);
	if (!resourceConfig) {
		throw new Error(
			`@Resource decorator missing on ${modelType.name}; cannot encode without a JSON:API type`,
		);
	}

	const doc: Document<R> = new Document();

	const resProps: Record<string, unknown> = { type: resourceConfig.type };
	const dataRec = data as unknown as Record<string, unknown>;

	if (!config.mustHaveEmptyId && dataRec['id']) {
		resProps['id'] = dataRec['id'];
	}
	if (config.mustHaveEmptyId && dataRec['lid']) {
		// JSON:API §Resource Objects: client-side new resources MAY include
		// `lid` so the same resource can be referenced within the same doc.
		resProps['lid'] = dataRec['lid'];
	}

	const attributes = encodeAttributes(modelType, data, config);
	const meta = encodeMeta(modelType, data);
	const links = encodeLinks(modelType, data);
	const relationships = encodeRelationships(modelType, data);

	if (Object.keys(attributes).length > 0) resProps['attributes'] = attributes;
	if (Object.keys(meta).length > 0) resProps['meta'] = meta;
	if (Object.keys(links).length > 0) resProps['links'] = links;
	if (Object.keys(relationships).length > 0) resProps['relationships'] = relationships;

	doc.data = resProps as unknown as resource;
	if (config.rootMeta) doc.meta = new Map(Object.entries(config.rootMeta)) as IMeta;
	if (config.mapIncluded) {
		doc.included = encodeIncluded(modelType, data, ...opts);
	}

	return doc;
};

const serializeCollection = <R extends IResource>(
	modelType: ModelType<R>,
	data: R[],
	...opts: EncoderOpt[]
): Document<R[]> => {
	const config = new EncoderConfig(...opts);
	const resourceConfig = getResourceConfig(modelType);
	if (!resourceConfig) {
		throw new Error(
			`@Resource decorator missing on ${modelType.name}; cannot encode without a JSON:API type`,
		);
	}

	const doc: Document<R[]> = new Document();
	const items: resource[] = [];
	const included: resource[] = [];

	for (const item of data) {
		const itemRec = item as unknown as Record<string, unknown>;
		const resProps: Record<string, unknown> = { type: resourceConfig.type };
		if (itemRec['id']) resProps['id'] = itemRec['id'];

		const attributes = encodeAttributes(modelType, item, config);
		const meta = encodeMeta(modelType, item);
		const links = encodeLinks(modelType, item);
		const relationships = encodeRelationships(modelType, item);

		if (Object.keys(attributes).length > 0) resProps['attributes'] = attributes;
		if (Object.keys(meta).length > 0) resProps['meta'] = meta;
		if (Object.keys(links).length > 0) resProps['links'] = links;
		if (Object.keys(relationships).length > 0) resProps['relationships'] = relationships;

		items.push(resProps as unknown as resource);

		if (config.mapIncluded) {
			included.push(...encodeIncluded(modelType, item, ...opts));
		}
	}

	doc.data = items as unknown as resource[];
	if (config.rootMeta) doc.meta = new Map(Object.entries(config.rootMeta)) as IMeta;
	if (config.mapIncluded) {
		const seen = new Set<string>();
		doc.included = included.filter((r) => {
			const k = includedKey(r);
			if (seen.has(k)) return false;
			seen.add(k);
			return true;
		});
	}

	return doc;
};

// ============================================================================
// Attribute / Meta / Links / Relationships encoders.
// ============================================================================

const encodeAttributes = <R extends IResource>(
	modelType: ModelType<R>,
	res: R,
	config: EncoderConfig,
): Record<string, unknown> => {
	const out: Record<string, unknown> = {};
	const attrProps = getAttributeProperties(modelType.prototype as object);
	const resRec = res as unknown as Record<string, unknown>;

	for (const serializedName of Object.keys(attrProps)) {
		const prop = attrProps[serializedName];
		const value = resRec[String(prop.key)];
		if (value === undefined || value === null) continue;

		// Strip server-managed timestamps on writes — by convention any field
		// named `timestamps` is the createdAt/updatedAt/deletedAt tuple.
		if (config.mustHaveEmptyTimestamps && serializedName === 'timestamps') {
			continue;
		}

		out[serializedName] = encodeAttributeValue(value, prop);
	}
	return out;
};

const encodeAttributeValue = (value: unknown, prop: AttributeProperty): unknown => {
	if (prop.type) {
		if (Array.isArray(value)) {
			return value.map((item) => serializeRaw(prop.type!, item));
		}
		if (value && typeof value === 'object' && !(value instanceof Date)) {
			return serializeRaw(prop.type, value);
		}
	}

	if (prop.transformer) return prop.transformer.serialize(value);

	if (value instanceof Map) {
		return Object.fromEntries(value.entries());
	}

	return value;
};

const encodeMeta = <R extends IResource>(
	modelType: ModelType<R>,
	res: R,
): Record<string, unknown> => {
	const out: Record<string, unknown> = {};
	const metaProps = getMetaProperties(modelType.prototype as object);
	const resRec = res as unknown as Record<string, unknown>;

	for (const serializedName of Object.keys(metaProps)) {
		const prop = metaProps[serializedName];
		const value = resRec[String(prop.key)];
		if (value === undefined || value === null) continue;
		out[serializedName] = encodeMetaValue(value, prop);
	}
	return out;
};

const encodeMetaValue = (value: unknown, prop: MetaProperty): unknown => {
	if (prop.type) {
		if (Array.isArray(value)) {
			return value.map((item) => serializeRaw(prop.type!, item));
		}
		if (value && typeof value === 'object' && !(value instanceof Date)) {
			return serializeRaw(prop.type, value);
		}
	}

	if (value instanceof Map) {
		return Object.fromEntries(value.entries());
	}

	return value;
};

const encodeLinks = <R extends IResource>(
	modelType: ModelType<R>,
	res: R,
): Record<string, unknown> => {
	const out: Record<string, unknown> = {};
	const linkProps = getLinkProperties(modelType.prototype as object);
	const resRec = res as unknown as Record<string, unknown>;

	for (const serializedName of Object.keys(linkProps)) {
		const value = resRec[String(linkProps[serializedName].key)];
		if (value === undefined || value === null) continue;
		out[serializedName] = value;
	}
	return out;
};

const encodeRelationships = <R extends IResource>(
	modelType: ModelType<R>,
	res: R,
): Record<string, relationship> => {
	const out: Record<string, relationship> = {};
	const relProps = getRelationshipProperties(modelType.prototype as object);
	const resRec = res as unknown as Record<string, unknown>;

	for (const serializedName of Object.keys(relProps)) {
		const value = resRec[String(relProps[serializedName].key)];
		if (value === undefined) continue;

		const targetConfig = getResourceConfig(relProps[serializedName].target);
		if (value === null) {
			out[serializedName] = new relationship({ data: null });
		} else if (Array.isArray(value)) {
			const identifiers = value.map((el: Record<string, unknown>) => {
				return new resourceIdentifier({
					id: el['id'] as string | undefined,
					type: (targetConfig?.type ?? el['type']) as string | undefined,
				});
			});
			out[serializedName] = new relationship({ data: identifiers });
		} else if (typeof value === 'object') {
			const el = value as Record<string, unknown>;
			out[serializedName] = new relationship({
				data: new resourceIdentifier({
					id: el['id'] as string | undefined,
					type: (targetConfig?.type ?? el['type']) as string | undefined,
				}),
			});
		}
	}
	return out;
};

/**
 * Serialise a plain value-object (no type/id) by walking only its
 * `@Attribute` decorators. Used for typed sub-attributes like Timestamps.
 */
const serializeRaw = <T>(modelType: ModelType<T>, value: unknown): unknown => {
	if (!value || typeof value !== 'object') return value;
	const valueRec = value as Record<string, unknown>;
	const attrProps = getAttributeProperties(modelType.prototype as object);
	const out: Record<string, unknown> = {};
	for (const serializedName of Object.keys(attrProps)) {
		const prop = attrProps[serializedName];
		const v = valueRec[String(prop.key)];
		if (v === undefined || v === null) continue;
		out[serializedName] = encodeAttributeValue(v, prop);
	}
	return out;
};

const encodeIncluded = <R extends IResource>(
	modelType: ModelType<R>,
	res: R,
	...opts: EncoderOpt[]
): resource[] => {
	const map = new Map<string, resource>();
	const relProps = getRelationshipProperties(modelType.prototype as object);
	const resRec = res as unknown as Record<string, unknown>;

	for (const serializedName of Object.keys(relProps)) {
		const value = resRec[String(relProps[serializedName].key)];
		if (!value) continue;
		const target = relProps[serializedName].target as ModelType<IResource>;

		if (Array.isArray(value)) {
			for (const el of value as IResource[]) {
				const doc = serialize(target, el, ...opts);
				const inner = doc.data as resource;
				map.set(includedKey(inner), inner);
			}
		} else if (typeof value === 'object') {
			const doc = serialize(target, value as IResource, ...opts);
			const inner = doc.data as resource;
			map.set(includedKey(inner), inner);
		}
	}
	return Array.from(map.values());
};
