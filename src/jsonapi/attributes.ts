export const attrTimestamps = 'timestamps';
/**
 * Attributes represent information about the resource object in which it’s defined.
 * attributes may contain any valid JSON value, including complex data structures
 * involving JSON objects and arrays.
 * Keys that reference related resources (e.g. author_id) SHOULD NOT appear as
 * attributes. Instead, relationships SHOULD be used.
 **/
// export class Attributes extends Map<string, any> {}
export type Attributes = Map<string, any>;
