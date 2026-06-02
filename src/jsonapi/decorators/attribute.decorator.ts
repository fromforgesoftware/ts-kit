import { type ModelType } from '../model/model.js';
import { type Transformer } from '../transformers/transformer.js';

// Property-level decorator marking a field as a JSON:API attribute.
//
// Two modes:
//   1. Primitive — `@Attribute()` (or `@Attribute({transformer})`). The
//      serialized value is the raw field value (or the transformer's
//      output for non-trivial types like Date).
//   2. Structured — `@Attribute({type: SubClass})`. The serialized value
//      is the recursive encoding of a nested object. The sub-class must
//      itself declare `@Attribute` decorators on its fields. Replaces
//      the old @NestedAttribute + @Wrapped pair.
//
// Example (primitive + structured):
//   class Author { @Attribute() name: string; }
//   class Article {
//     @Attribute() title: string;
//     @Attribute({ transformer: DateTransformer }) createdAt: Date;
//     @Attribute({ type: Author }) author: Author;
//   }

const ATTRIBUTE_METADATA_KEY = 'attribute:metadata';

export interface AttributeProperty {
	target: object;
	key: string | symbol;
	transformer?: Transformer;
	/** Set when the attribute is itself a class with its own decorators. */
	type?: ModelType<unknown>;
}

export type AttributeProperties = Record<string, AttributeProperty>;

export function getAttributeProperties(target: object): AttributeProperties {
	return (Reflect.getMetadata(ATTRIBUTE_METADATA_KEY, target) as AttributeProperties) || {};
}

export interface AttributeDecoratorOptions {
	serializedName?: string;
	transformer?: Transformer;
	/**
	 * When set, the attribute is decoded/encoded recursively against
	 * the target class's own @Attribute metadata. Used for typed
	 * sub-objects like `timestamps`, `address`, `coordinates`, etc.
	 */
	type?: ModelType<unknown>;
}

export function Attribute(options: AttributeDecoratorOptions = {}): PropertyDecorator {
	return (target: object, propertyKey: string | symbol) => {
		const meta: AttributeProperties = Reflect.getMetadata(ATTRIBUTE_METADATA_KEY, target) || {};
		const serializedPropertyName =
			options.serializedName !== undefined ? options.serializedName : String(propertyKey);
		meta[serializedPropertyName] = {
			target,
			key: propertyKey,
			transformer: options.transformer,
			type: options.type,
		};
		Reflect.defineMetadata(ATTRIBUTE_METADATA_KEY, meta, target);
	};
}
