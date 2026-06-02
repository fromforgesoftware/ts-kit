import { type ILinks } from './links.js';
import { type IMeta } from './meta.js';

export type Relationships = Map<string, IRelationship>;

/**
Relationship is a "relationship object" and MUST contain at least one of the following:
  - links
  - data
  - meta
  - a member defined by an applied extension.
**/
export interface IRelationship {
	/**
		Links object containing at least one of the following:
			-  self: A link for the relationship itself (a “relationship link”).
			This link allows the client to directly manipulate the relationship.
			For example, removing an author through an article’s relationship URL
			would disconnect the person from the article without deleting the
			people resource itself. When fetched successfully, this link returns
			the linkage for the related resources as its primary data.
			-  related: a related resource link
			-  a member defined by an applied extension.
			-  A relationship object that represents a to-many relationship MAY also contain
			pagination links.
			Any pagination links in a relationship object MUST paginate the relationship data,
			not the related resources.
  **/
	Links(): ILinks;
	/**
		Resource linkage
  **/
	Data(): ResourceLinkage;
	/**
		Meta object that contains non-standard meta-information about the relationship.
  **/
	Meta(): IMeta;
}

/**
 * LinkObj is an object that represents a web link.
 * A link object MUST contain the following member:
 *   - href: a string whose value is a URI-reference [RFC3986 Section 4.1]
 *     pointing to the link’s target.
 *
 * A link object MAY also contain any of the following members:
 *   - rel: a string indicating the link’s relation type. The string MUST be
 *     a valid link relation type.
 *   - describedby: a link to a description document (e.g. OpenAPI or JSON Schema)
 *     for the link target.
 *   - title: a string which serves as a label for the destination of a link such
 *     that it can be used as a human-readable identifier (e.g., a menu entry).
 *   - type: a string indicating the media type of the link’s target.
 *   - hreflang: a string or an array of strings indicating the language(s)
 *     of the link’s target. An array of strings indicates that the link’s
 *     target is available in multiple languages.
 *     Each string MUST be a valid language tag [RFC5646].
 *   - meta: a meta object containing non-standard meta-information about the link.
 *
 * Note: the type and hreflang members are only hints; the target resource is not
 * guaranteed to be available in the indicated media type or language when the link
 * is actually followed
 **/
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type LinkObj = any;

/**
 * ResourceLinkage in a compound document allows a client to link together all of the included
 * resource objects without having to GET any URLs via links.
 *
 * Resource linkage MUST be represented as one of the following:
 *   - null for empty to-one relationships.
 *   - an empty array ([]) for empty to-many relationships.
 *   - a single resource identifier object for non-empty to-one relationships.
 *   - an array of resource identifier objects for non-empty to-many relationships
 **/
type ResourceLinkage = any;

export class relationship implements IRelationship {
	data: any;
	links: ILinks;
	meta: IMeta;

	constructor(data?: any) {
		this.data = data.data;
		this.links = data.links ? new Map(Object.entries(data.links)) : undefined;
		this.meta = data.meta ? new Map(Object.entries(data.meta)) : undefined;
	}

	Links(): ILinks {
		return this.links;
	}

	Data(): any {
		return this.data;
	}

	Meta(): IMeta {
		return this.meta;
	}
}
