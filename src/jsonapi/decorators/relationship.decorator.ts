// Property-level decorator for JSON:API relationship members.
// `target` is the related resource class — needed so the decoder can
// instantiate the right type when expanding `included` resources.

import { type ModelType } from '../model/model.js';

const RELATIONSHIP_METADATA_KEY = 'relationship:metadata';

export interface RelationshipProperty {
	target: ModelType<unknown>;
	key: string | symbol;
}

export type RelationshipProperties = Record<string, RelationshipProperty>;

export function getRelationshipProperties(target: object): RelationshipProperties {
	return (Reflect.getMetadata(RELATIONSHIP_METADATA_KEY, target) as RelationshipProperties) || {};
}

export interface RelationshipDecoratorOptions {
	type: ModelType<unknown>;
	serializedName?: string;
}

export function Relationship(options: RelationshipDecoratorOptions): PropertyDecorator {
	return (target: object, propertyKey: string | symbol) => {
		const meta: RelationshipProperties =
			Reflect.getMetadata(RELATIONSHIP_METADATA_KEY, target) || {};
		const serializedPropertyName =
			options.serializedName !== undefined ? options.serializedName : String(propertyKey);
		meta[serializedPropertyName] = {
			target: options.type,
			key: propertyKey,
		};
		Reflect.defineMetadata(RELATIONSHIP_METADATA_KEY, meta, target);
	};
}
