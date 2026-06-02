/**
 * Links member can be used to represent links. The value of this member MUST be an object (a “links object”).
 * Within this object, a link MUST be represented as either:
 *   - a string whose value is a URI-reference [RFC3986 Section 4.1] pointing to the link’s target,
 *   - a link object
 *   - null if the link does not exist.
 *
 * A link’s relation type SHOULD be inferred from the name of the link unless the link is a link
 * object and the link object has a rel member.
 *
 * A link’s context is the top-level object, resource object, or relationship object in which it appears.
 * In the example below, the self link is a string whereas the related link is a link object.
 * The related link object provides additional information about the targeted related resource
 * collection as well as a schema that serves as a description document for that collection:
 *
 * 	"links": {
 * 	  "self": "http://example.com/articles/1/relationships/comments",
 * 	  "related": {
 * 	    "href": "http://example.com/articles/1/comments",
 * 	    "title": "Comments",
 * 	    "describedby": "http://example.com/schemas/article-comments",
 * 	    "meta": {
 * 	      "count": 10
 * 	    }
 * 	  }
 * 	}
 **/
export type ILinks = Map<string, any>;

export const addURI = (links: Map<string, any>, name: linkName, uri: string): void => {
	links.set(name, uri);
};

export type linkName = string;

export const linkNameSelf: linkName = 'self';

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
 * is actually followed.
 **/
export type LinkObj = any;

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
export type ResourceLinkage = any;
