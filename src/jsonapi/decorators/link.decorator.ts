// Property-level decorator marking a field as a JSON:API link.
//
// JSON:API §Links (https://jsonapi.org/format/#document-links): a link
// in `links.<name>` is either a URL string or a link object with `href`
// and optional `rel/describedby/title/type/hreflang/meta`. This decorator
// declares which resource fields are wired to which links by name; the
// encoder/decoder mirror the value in/out of the `links` member.
//
// Example:
//   class Article extends Resource {
//     @Link() self: string;       // "links.self"
//     @Link({ rel: 'next' }) next: string;
//   }

const LINK_METADATA_KEY = 'link:metadata';

export interface LinkProperty {
	target: object;
	key: string | symbol;
	rel?: string;
}

export type LinkProperties = Record<string, LinkProperty>;

export function getLinkProperties(target: object): LinkProperties {
	return (Reflect.getMetadata(LINK_METADATA_KEY, target) as LinkProperties) || {};
}

export interface LinkDecoratorOptions {
	serializedName?: string;
	rel?: string;
}

export function Link(options: LinkDecoratorOptions = {}): PropertyDecorator {
	return (target: object, propertyKey: string | symbol) => {
		const meta: LinkProperties = Reflect.getMetadata(LINK_METADATA_KEY, target) || {};
		const serializedPropertyName =
			options.serializedName !== undefined ? options.serializedName : String(propertyKey);
		meta[serializedPropertyName] = {
			target,
			key: propertyKey,
			rel: options.rel,
		};
		Reflect.defineMetadata(LINK_METADATA_KEY, meta, target);
	};
}
