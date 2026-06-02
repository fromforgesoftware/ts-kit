import { type Attributes } from './attributes';
import { type ILinks } from './links';
import { type IMeta } from './meta';
import { type Relationships, relationship } from './relationships';

/**
 * ResourceID — the (type, id) (or (type, lid)) tuple that uniquely
 * identifies a resource within a JSON:API document. See spec §
 * "Resource Object Identification".
 */
export interface ResourceID {
	ID(): string;
	LID(): string;
	Type(): string;
	Meta(): IMeta;
}

/**
 * IResourceObject — the wire-level shape of a JSON:API resource object,
 * per spec § "Resource Objects". A resource object MUST have at least
 * `id` (or `lid` for client-side new resources) and `type`. It MAY have
 * `attributes`, `relationships`, `links`, and `meta`.
 *
 * Distinct from `Resource` (the consumer-facing base class in
 * model/resource.ts) — that's the typed projection consumers extend.
 */
export interface IResourceObject extends ResourceID {
	Attributes(): Attributes;
	Relationships(): Relationships;
	Links(): ILinks;
}

interface resourceTimestampsProps {
	createdAt: Date;
	updatedAt: Date;
	deletedAt?: Date;
}

/**
 * Server-managed createdAt/updatedAt/deletedAt — a project convention,
 * not part of the JSON:API spec. Encoded as a nested attribute under
 * `attributes.timestamps`. Pre-rewrite versions of this class had a
 * copy-paste bug where every accessor returned `createdAt`; fixed here.
 */
export class resourceTimestamps {
	createdAt: Date;
	updatedAt: Date;
	deletedAt?: Date;

	constructor(props: resourceTimestampsProps) {
		this.createdAt = props.createdAt;
		this.updatedAt = props.updatedAt;
		this.deletedAt = props.deletedAt;
	}

	CreatedAt(): Date {
		return this.createdAt;
	}
	UpdatedAt(): Date {
		return this.updatedAt;
	}
	DeletedAt(): Date | undefined {
		return this.deletedAt;
	}
}

export class resourceIdentifier {
	id: string;
	lid: string;
	type: string;

	constructor(data?: { id?: string; lid?: string; type?: string }) {
		if (data) {
			this.id = data.id;
			this.lid = data.lid;
			this.type = data.type;
		}
	}

	ID(): string {
		return this.id;
	}
	LID(): string {
		return this.lid;
	}
	Type(): string {
		return this.type;
	}
}

export class resource extends resourceIdentifier implements IResourceObject {
	attributes: Attributes;
	relationships: Relationships;
	links: ILinks;
	meta: IMeta;

	constructor(data?: unknown) {
		super(data as { id?: string; lid?: string; type?: string });

		if (!data || typeof data !== 'object') return;
		const d = data as Record<string, unknown>;

		if (d['attributes']) {
			this.attributes =
				d['attributes'] instanceof Map
					? (d['attributes'] as Attributes)
					: (new Map(Object.entries(d['attributes'] as Record<string, unknown>)) as Attributes);
		}

		if (d['relationships']) {
			if (d['relationships'] instanceof Map) {
				this.relationships = d['relationships'] as Relationships;
			} else {
				this.relationships = new Map(
					Object.entries(d['relationships'] as Record<string, unknown>).map(([k, v]) => [
						k,
						new relationship(v),
					]),
				) as Relationships;
			}
		}

		if (d['links']) {
			this.links =
				d['links'] instanceof Map
					? (d['links'] as ILinks)
					: (new Map(Object.entries(d['links'] as Record<string, unknown>)) as ILinks);
		}

		if (d['meta']) {
			this.meta =
				d['meta'] instanceof Map
					? (d['meta'] as IMeta)
					: (new Map(Object.entries(d['meta'] as Record<string, unknown>)) as IMeta);
		}
	}

	Attributes(): Attributes {
		return this.attributes;
	}
	Relationships(): Relationships {
		return this.relationships;
	}
	Meta(): IMeta {
		return this.meta;
	}
	Links(): ILinks {
		return this.links;
	}
}
