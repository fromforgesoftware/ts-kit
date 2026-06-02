import { specVersion } from './document.js';
import { type IMeta } from './meta.js';

// The JSON:API media type is application/vnd.api+json
// MediaType media.MimeType = "application/vnd.api+json"
export const MEDIA_TYPE = 'application/vnd.api+json';

export const HEADER_CONTENT_TYPE = 'Content-Type';
export const HEADER_ACCEPT = 'Accept';

/**
 * Spec on a JSON:API document MAY include information about its implementation under a
 * top level jsonapi member. If present, the value of the jsonapi member MUST be
 * an object (a “jsonapi object”).
 * The jsonapi object MAY contain any of the following members:
 *   - version
 *   - ext
 *   - profile
 *   - meta
 *
 * Clients and servers MUST NOT use an ext or profile member for content negotiation.
 * Content negotiation MUST only happen based on media type parameters in Content-Type header.
 * A simple example appears below:
 *
 * 	{
 * 	  "jsonapi": {
 * 	    "version": "1.1",
 * 	    "ext": [
 * 	      "https://jsonapi.org/ext/atomic"
 * 	    ],
 * 	    "profile": [
 * 	      "http://example.com/profiles/flexible-pagination",
 * 	      "http://example.com/profiles/resource-versioning"
 * 	    ]
 * 	  }
 * 	}
 *
 * If the version member is not present, clients should assume the server implements
 * at least version 1.0 of the specification.
 * Note: Because JSON:API is committed to making additive changes only, the version
 * string primarily indicates which new features a server may support
 **/
export interface ISpec {
	/**
	 * Version value is a string indicating the highest JSON:API version supported.
	 **/
	Version(): string;

	/**
	 * Ext is an array of URIs for all applied extensions.
	 **/
	Ext(): string[];

	/**
	 * Profile is an array of URIs for all applied profiles.
	 **/
	Profile(): string[];

	/**
	 * Meta object that contains non-standard meta-information.
	 **/
	Meta(): IMeta;
}

export class Spec implements ISpec {
	private version: string;
	private ext: string[];
	private profile: string[];
	private meta: IMeta;

	constructor() {
		this.version = specVersion;
	}

	Version(): string {
		return this.version;
	}

	Ext(): string[] {
		return this.ext;
	}

	Profile(): string[] {
		return this.profile;
	}

	Meta(): IMeta {
		return this.meta;
	}
}
