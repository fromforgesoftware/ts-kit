// Class-level decorator. Declares the JSON:API `type` for a resource
// class. Use `@JsonApi({ type })` rather than the old `@ResourceConfig`
// — same metadata, shorter name, no collision with the `Resource` base
// class consumers extend.
//
// Example:
//   @JsonApi({ type: 'articles' })
//   export class Article extends Resource { … }

const RESOURCE_METADATA_KEY = 'resource:metadata';

export interface IResourceConfig {
	type: string;
}

export function getResourceConfig(target: unknown): IResourceConfig | undefined {
	const meta = Reflect.getMetadata(RESOURCE_METADATA_KEY, target as object);
	return meta || undefined;
}

export function JsonApi(config: IResourceConfig): ClassDecorator {
	return (target: object) => {
		Reflect.defineMetadata(RESOURCE_METADATA_KEY, config, target);
	};
}
