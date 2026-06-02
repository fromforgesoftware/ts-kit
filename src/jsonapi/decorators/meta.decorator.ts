// Property-level decorator for JSON:API meta members.
//
// Two modes:
//   - `@Meta()` — value is the raw field (primitive or plain object).
//   - `@Meta({type: SubClass})` — value is decoded/encoded recursively
//     against the sub-class's @Meta decorators. Use for typed nested
//     meta-objects (e.g. `meta.pagination = {total, page, hasNext}`).

import { type ModelType } from '../model/model';

const META_METADATA_KEY = 'meta:metadata';

export interface MetaProperty {
	target: object;
	key: string | symbol;
	type?: ModelType<unknown>;
}

export type MetaProperties = Record<string, MetaProperty>;

export function getMetaProperties(target: object): MetaProperties {
	return (Reflect.getMetadata(META_METADATA_KEY, target) as MetaProperties) || {};
}

export interface MetaDecoratorOptions {
	type?: ModelType<unknown>;
	serializedName?: string;
}

export function Meta(options: MetaDecoratorOptions = {}): PropertyDecorator {
	return (target: object, propertyKey: string | symbol) => {
		const meta: MetaProperties = Reflect.getMetadata(META_METADATA_KEY, target) || {};
		const serializedPropertyName =
			options.serializedName !== undefined ? options.serializedName : String(propertyKey);
		meta[serializedPropertyName] = {
			target,
			key: propertyKey,
			type: options.type,
		};
		Reflect.defineMetadata(META_METADATA_KEY, meta, target);
	};
}
